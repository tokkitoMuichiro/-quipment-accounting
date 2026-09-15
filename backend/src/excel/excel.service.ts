import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { BitrixService } from '../bitrix/bitrix.service';
import { cardKindLabel, vehicleKindLabel } from '../equipment/asset-helpers';

const CONDITION_LABEL: Record<string, string> = {
  OK: 'Исправное',
  NEEDS_REPAIR: 'Требует ремонта',
  IN_REPAIR: 'В ремонте',
  IRREPARABLE: 'Не подлежит ремонту',
};

@Injectable()
export class ExcelService implements OnModuleDestroy {
  private readonly logger = new Logger(ExcelService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bitrix: BitrixService,
    private readonly config: ConfigService,
  ) {}

  scheduleSync() {
    const delay = Number(this.config.get('EXCEL_DEBOUNCE_MS') || 60000);
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.syncToBitrix().catch((err) =>
        this.logger.error('Автовыгрузка Excel не удалась', err),
      );
    }, delay);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  private ownerLabel(item: {
    ownerType: string;
    ownerUser?: { fullName: string } | null;
    ownerWarehouse?: { name: string } | null;
  }) {
    return item.ownerType === 'USER'
      ? item.ownerUser?.fullName || 'Не назначен'
      : `База: ${item.ownerWarehouse?.name || 'не указана'}`;
  }

  private pendingLabel(item: {
    pendingTransfer?: { status: string; toLabel?: string | null } | null;
  }) {
    return item.pendingTransfer?.status === 'PENDING'
      ? item.pendingTransfer.toLabel || 'Да'
      : '';
  }

  private styleHeader(sheet: ExcelJS.Worksheet) {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1C2833' },
    };
  }

  async buildWorkbookBuffer(): Promise<Buffer> {
    const items = await this.prisma.equipment.findMany({
      include: {
        ownerUser: true,
        ownerWarehouse: true,
        pendingTransfer: true,
      },
      orderBy: [{ name: 'asc' }, { factoryNumber: 'asc' }, { plateNumber: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Учёт оборудования';
    workbook.created = new Date();

    const equipmentSheet = workbook.addWorksheet('Оборудование', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    equipmentSheet.columns = [
      { header: 'Наименование', key: 'name', width: 36 },
      { header: 'Заводской номер', key: 'factoryNumber', width: 22 },
      { header: 'Кол-во', key: 'quantity', width: 10 },
      { header: 'Состояние', key: 'condition', width: 32 },
      { header: 'Пояснение', key: 'conditionNote', width: 40 },
      { header: 'Паспорта и сертификаты', key: 'hasDocuments', width: 24 },
      { header: 'Тип', key: 'type', width: 16 },
      { header: 'Владелец', key: 'owner', width: 36 },
      { header: 'Ожидает принятия', key: 'pending', width: 28 },
      { header: 'Дата обновления', key: 'updatedAt', width: 22 },
    ];
    this.styleHeader(equipmentSheet);

    const vehicleSheet = workbook.addWorksheet('Транспорт', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    vehicleSheet.columns = [
      { header: 'Наименование', key: 'name', width: 36 },
      { header: 'Госномер', key: 'plateNumber', width: 18 },
      { header: 'Вид ТС', key: 'vehicleKind', width: 18 },
      { header: 'Состояние', key: 'condition', width: 32 },
      { header: 'Пояснение', key: 'conditionNote', width: 40 },
      { header: 'Владелец', key: 'owner', width: 36 },
      { header: 'Ожидает принятия', key: 'pending', width: 28 },
      { header: 'Дата обновления', key: 'updatedAt', width: 22 },
    ];
    this.styleHeader(vehicleSheet);

    const cardSheet = workbook.addWorksheet('Карты', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    cardSheet.columns = [
      { header: 'Вид карты', key: 'cardKind', width: 22 },
      { header: 'Номер', key: 'cardNumber', width: 22 },
      { header: 'Наименование', key: 'name', width: 36 },
      { header: 'Владелец', key: 'owner', width: 36 },
      { header: 'Ожидает принятия', key: 'pending', width: 28 },
      { header: 'Дата обновления', key: 'updatedAt', width: 22 },
    ];
    this.styleHeader(cardSheet);

    for (const item of items) {
      const owner = this.ownerLabel(item);
      const pending = this.pendingLabel(item);
      const updatedAt = item.updatedAt.toLocaleString('ru-RU');

      if (item.category === 'VEHICLE') {
        vehicleSheet.addRow({
          name: item.name,
          plateNumber: item.plateNumber || '',
          vehicleKind: vehicleKindLabel(item.vehicleKind),
          condition: CONDITION_LABEL[item.condition] || item.condition,
          conditionNote: item.conditionNote || '',
          owner,
          pending,
          updatedAt,
        });
        continue;
      }

      if (item.category === 'CARD') {
        cardSheet.addRow({
          cardKind: cardKindLabel(item.cardKind),
          cardNumber:
            item.cardKind === 'BUSINESS' && item.cardNumber
              ? `****${item.cardNumber}`
              : item.cardNumber || '',
          name: item.name,
          owner,
          pending,
          updatedAt,
        });
        continue;
      }

      equipmentSheet.addRow({
        name: item.name,
        factoryNumber: item.factoryNumber || '',
        quantity: item.quantity,
        condition: CONDITION_LABEL[item.condition] || item.condition,
        conditionNote: item.conditionNote || '',
        hasDocuments: item.hasDocuments ? 'Да' : 'Нет',
        type: item.type === 'SERIAL' ? 'Серийное' : 'Неномерное',
        owner,
        pending,
        updatedAt,
      });
    }

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  async syncToBitrix() {
    const portal = await this.prisma.bitrixPortal.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    if (!portal) {
      this.logger.warn('Портал Битрикс не установлен — Excel сохранён только локально в ответе API');
      return { uploaded: false, reason: 'no_portal' };
    }

    const filename =
      this.config.get<string>('BITRIX_EXCEL_FILENAME') ||
      'Учёт оборудования (авто).xlsx';
    const buffer = await this.buildWorkbookBuffer();
    const fileContent = buffer.toString('base64');

    let folderId = portal.excelFolderId;
    if (!folderId) {
      const storage = await this.bitrix.callWithPortal(
        portal,
        'disk.storage.getforapp',
      );
      folderId = String(storage.result?.ROOT_OBJECT_ID || storage.result?.ID);
      if (folderId) {
        await this.prisma.bitrixPortal.update({
          where: { id: portal.id },
          data: { excelFolderId: folderId },
        });
      }
    }

    if (!folderId) {
      throw new Error('Не удалось получить папку приложения на Диске Битрикс');
    }

    if (portal.excelFileId) {
      try {
        await this.bitrix.callWithPortal(portal, 'disk.file.uploadversion', {
          id: portal.excelFileId,
          fileContent: [filename, fileContent],
        });
        return { uploaded: true, fileId: portal.excelFileId };
      } catch (error) {
        this.logger.warn('uploadversion не удался, создаём файл заново', error);
      }
    }

    const uploaded = await this.bitrix.callWithPortal(
      portal,
      'disk.folder.uploadfile',
      {
        id: folderId,
        data: { NAME: filename },
        fileContent: [filename, fileContent],
        generateUniqueName: false,
      },
    );

    const fileId = String(uploaded.result?.ID || uploaded.result?.id || '');
    if (fileId) {
      await this.prisma.bitrixPortal.update({
        where: { id: portal.id },
        data: { excelFileId: fileId },
      });
    }

    return { uploaded: true, fileId };
  }
}

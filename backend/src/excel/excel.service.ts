import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { BitrixService } from '../bitrix/bitrix.service';

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

  async buildWorkbookBuffer(): Promise<Buffer> {
    const items = await this.prisma.equipment.findMany({
      include: { ownerUser: true, ownerWarehouse: true },
      orderBy: [{ name: 'asc' }, { factoryNumber: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Учёт оборудования';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Оборудование', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'Наименование', key: 'name', width: 36 },
      { header: 'Заводской номер', key: 'factoryNumber', width: 22 },
      { header: 'Кол-во', key: 'quantity', width: 10 },
      { header: 'Состояние', key: 'condition', width: 32 },
      { header: 'Пояснение', key: 'conditionNote', width: 40 },
      { header: 'Паспорта и сертификаты', key: 'hasDocuments', width: 24 },
      { header: 'Тип', key: 'type', width: 16 },
      { header: 'Владелец', key: 'owner', width: 36 },
      { header: 'Дата обновления', key: 'updatedAt', width: 22 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1C2833' },
    };

    for (const item of items) {
      const owner =
        item.ownerType === 'USER'
          ? item.ownerUser?.fullName || 'Не назначен'
          : `База: ${item.ownerWarehouse?.name || 'не указана'}`;

      sheet.addRow({
        name: item.name,
        factoryNumber: item.factoryNumber || '',
        quantity: item.quantity,
        condition: CONDITION_LABEL[item.condition] || item.condition,
        conditionNote: item.conditionNote || '',
        hasDocuments: item.hasDocuments ? 'Да' : 'Нет',
        type: item.type === 'SERIAL' ? 'Серийное' : 'Расходник',
        owner,
        updatedAt: item.updatedAt.toLocaleString('ru-RU'),
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

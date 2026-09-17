import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, canEditDocuments } from '../common/auth-user';
import { DiskService } from '../bitrix/disk.service';
import {
  DOC_ALLOWED_MIME,
  DOC_MAX_BYTES,
  DOC_MAX_LABEL,
  UploadedMemoryFile,
  decodeUploadFileName,
} from '../bitrix/document.constants';
import { ExcelService } from '../excel/excel.service';
import { DocumentsSyncService } from './documents-sync.service';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly disk: DiskService,
    private readonly excel: ExcelService,
    private readonly sync: DocumentsSyncService,
  ) {}

  private assertDocsCategory(category: string) {
    if (category === 'CARD') {
      throw new BadRequestException(
        'К картам нельзя прикреплять документы',
      );
    }
  }

  async list(equipmentId: string, user: AuthUser) {
    const item = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
    });
    if (!item) {
      throw new NotFoundException('Позиция не найдена');
    }
    this.assertDocsCategory(item.category);

    try {
      await this.sync.syncEquipment(equipmentId);
    } catch (error) {
      this.logger.warn(
        `Не удалось сверить документы позиции ${equipmentId} с Битрикс`,
        error as Error,
      );
    }

    return this.prisma.equipmentDocument.findMany({
      where: { equipmentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        uploadedById: true,
      },
    });
  }

  async upload(
    equipmentId: string,
    file: UploadedMemoryFile | undefined,
    user: AuthUser,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Файл не передан');
    }
    if (file.size > DOC_MAX_BYTES) {
      throw new BadRequestException(`Файл больше ${DOC_MAX_LABEL}`);
    }
    if (!DOC_ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Допустимы PDF, JPG, PNG, WEBP, DOC, DOCX',
      );
    }

    const item = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
    });
    if (!item) {
      throw new NotFoundException('Позиция не найдена');
    }
    this.assertDocsCategory(item.category);
    if (!canEditDocuments(user, item)) {
      throw new ForbiddenException();
    }

    const portal = await this.disk.requirePortal();
    const folderId = await this.disk.ensureEquipmentFolder(portal, item);
    const safeName = decodeUploadFileName(file.originalname)
      .replace(/[\\/]+/g, '_')
      .slice(0, 180);
    const bitrixFileId = await this.disk.uploadToFolder(
      portal,
      folderId,
      safeName || 'document',
      file.buffer,
    );

    const doc = await this.prisma.equipmentDocument.create({
      data: {
        equipmentId: item.id,
        originalName: safeName || 'document',
        mimeType: file.mimetype,
        sizeBytes: file.size,
        bitrixFileId,
        uploadedById: user.id,
      },
    });

    await this.prisma.equipment.update({
      where: { id: item.id },
      data: { hasDocuments: true },
    });
    this.excel.scheduleSync();

    return {
      id: doc.id,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      createdAt: doc.createdAt,
    };
  }

  async download(documentId: string, user: AuthUser) {
    const doc = await this.prisma.equipmentDocument.findUnique({
      where: { id: documentId },
      include: { equipment: true },
    });
    if (!doc) {
      throw new NotFoundException('Документ не найден');
    }
    this.assertDocsCategory(doc.equipment.category);

    const portal = await this.disk.requirePortal();
    const file = await this.disk.downloadFile(portal, doc.bitrixFileId);
    return {
      buffer: file.buffer,
      originalName: doc.originalName || file.name,
      mimeType: doc.mimeType || file.mimeType,
    };
  }

  async remove(documentId: string, user: AuthUser) {
    const doc = await this.prisma.equipmentDocument.findUnique({
      where: { id: documentId },
      include: { equipment: true },
    });
    if (!doc) {
      throw new NotFoundException('Документ не найден');
    }
    if (!canEditDocuments(user, doc.equipment)) {
      throw new ForbiddenException();
    }

    const portal = await this.disk.requirePortal();
    await this.disk.deleteFile(portal, doc.bitrixFileId);
    await this.prisma.equipmentDocument.delete({ where: { id: doc.id } });

    const remaining = await this.prisma.equipmentDocument.count({
      where: { equipmentId: doc.equipmentId },
    });
    await this.prisma.equipment.update({
      where: { id: doc.equipmentId },
      data: { hasDocuments: remaining > 0 },
    });
    this.excel.scheduleSync();

    return { ok: true };
  }
}

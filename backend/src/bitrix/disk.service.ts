import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import { BitrixService } from './bitrix.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCOUNTING_FOLDER_NAME,
  DOCS_FOLDER_NAME,
  equipmentFolderName,
  guessMimeFromName,
} from './document.constants';

export type BitrixDiskFile = {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
};

export type PortalRow = {
  id: string;
  domain: string;
  accessToken: string;
  refreshToken: string;
  accountingFolderId?: string | null;
  docsFolderId?: string | null;
  excelFolderId?: string | null;
  excelFileId?: string | null;
};

@Injectable()
export class DiskService {
  private readonly logger = new Logger(DiskService.name);

  constructor(
    private readonly bitrix: BitrixService,
    private readonly prisma: PrismaService,
  ) {}

  async requirePortal(): Promise<PortalRow> {
    const portal = await this.prisma.bitrixPortal.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    if (!portal) {
      throw new ServiceUnavailableException(
        'Портал Битрикс не установлен — загрузка документов недоступна',
      );
    }
    return portal;
  }

  private async call(
    portal: PortalRow,
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 60_000,
  ) {
    return this.bitrix.callWithPortal(portal, method, params, timeoutMs);
  }

  private childName(item: Record<string, unknown>): string {
    return String(item.NAME || item.name || '').trim();
  }

  private childId(item: Record<string, unknown>): string {
    return String(item.ID || item.id || '');
  }

  private isFolder(item: Record<string, unknown>): boolean {
    const type = String(item.TYPE || item.type || '').toUpperCase();
    return type === 'FOLDER' || item.TYPE === 2 || item.type === 2;
  }

  async listChildren(portal: PortalRow, folderId: string) {
    const children: Record<string, unknown>[] = [];
    let start: number | undefined = 0;
    while (true) {
      const data = await this.call(portal, 'disk.folder.getchildren', {
        id: folderId,
        start,
      });
      const batch = (data.result || []) as Record<string, unknown>[];
      children.push(...batch);
      if (data.next == null) {
        break;
      }
      start = data.next;
      if (children.length > 5000) {
        break;
      }
    }
    return children;
  }

  /** Subfolders of a folder as `name -> id`, used by the documents sync. */
  async listSubfolders(
    portal: PortalRow,
    parentId: string,
  ): Promise<Map<string, string>> {
    const children = await this.listChildren(portal, parentId);
    const map = new Map<string, string>();
    for (const child of children) {
      if (!this.isFolder(child)) continue;
      const name = this.childName(child);
      const id = this.childId(child);
      if (name && id && !map.has(name)) {
        map.set(name, id);
      }
    }
    return map;
  }

  /** Files directly inside a folder; returns null when the folder is gone. */
  async listFolderFiles(
    portal: PortalRow,
    folderId: string,
  ): Promise<BitrixDiskFile[] | null> {
    let children: Record<string, unknown>[];
    try {
      children = await this.listChildren(portal, folderId);
    } catch (error) {
      this.logger.warn(
        `Не удалось прочитать папку Bitrix ${folderId}`,
        error as Error,
      );
      return null;
    }
    return children
      .filter((child) => !this.isFolder(child))
      .map((child) => {
        const name = this.childName(child) || 'document';
        return {
          id: this.childId(child),
          name,
          sizeBytes: Number(child.SIZE || child.size || 0) || 0,
          mimeType: String(
            child.CONTENT_TYPE || child.contentType || '',
          ) || guessMimeFromName(name),
        };
      })
      .filter((file) => Boolean(file.id));
  }

  async findOrCreateSubfolder(
    portal: PortalRow,
    parentId: string,
    name: string,
  ): Promise<string> {
    const children = await this.listChildren(portal, parentId);
    const existing = children.find(
      (c) => this.isFolder(c) && this.childName(c) === name,
    );
    if (existing) {
      return this.childId(existing);
    }
    const created = await this.call(portal, 'disk.folder.addsubfolder', {
      id: parentId,
      data: { NAME: name },
    });
    const id = String(created.result?.ID || created.result?.id || '');
    if (!id) {
      throw new ServiceUnavailableException(
        `Не удалось создать папку «${name}» на Диске Битрикс`,
      );
    }
    return id;
  }

  async ensureCommonRoot(portal: PortalRow): Promise<string> {
    const list = await this.call(portal, 'disk.storage.getlist', {});
    const storages = (list.result || []) as Record<string, unknown>[];
    const common =
      storages.find((s) => {
        const entity = String(s.ENTITY_TYPE || s.entityType || '').toLowerCase();
        return entity === 'common';
      }) ||
      storages.find((s) => {
        const name = String(s.NAME || s.name || '').toLowerCase();
        return name.includes('общ');
      });

    if (!common) {
      throw new ServiceUnavailableException(
        'Не найден общий диск Битрикс (disk.storage.getlist)',
      );
    }

    const rootId = String(
      common.ROOT_OBJECT_ID || common.rootObjectId || common.ID || common.id || '',
    );
    if (!rootId) {
      throw new ServiceUnavailableException(
        'У общего диска Битрикс нет ROOT_OBJECT_ID',
      );
    }
    return rootId;
  }

  async ensureAccountingFolder(portal: PortalRow): Promise<string> {
    if (portal.accountingFolderId) {
      return portal.accountingFolderId;
    }
    if (portal.excelFolderId) {
      // legacy app-storage id — не используем как общий диск
    }

    const rootId = await this.ensureCommonRoot(portal);
    const folderId = await this.findOrCreateSubfolder(
      portal,
      rootId,
      ACCOUNTING_FOLDER_NAME,
    );

    await this.prisma.bitrixPortal.update({
      where: { id: portal.id },
      data: {
        accountingFolderId: folderId,
        excelFolderId: folderId,
      },
    });
    portal.accountingFolderId = folderId;
    portal.excelFolderId = folderId;
    return folderId;
  }

  async ensureDocsFolder(portal: PortalRow): Promise<string> {
    if (portal.docsFolderId) {
      return portal.docsFolderId;
    }
    const accountingId = await this.ensureAccountingFolder(portal);
    const docsId = await this.findOrCreateSubfolder(
      portal,
      accountingId,
      DOCS_FOLDER_NAME,
    );
    await this.prisma.bitrixPortal.update({
      where: { id: portal.id },
      data: { docsFolderId: docsId },
    });
    portal.docsFolderId = docsId;
    return docsId;
  }

  async ensureEquipmentFolder(
    portal: PortalRow,
    equipment: {
      id: string;
      name: string;
      factoryNumber?: string | null;
      plateNumber?: string | null;
      category?: string | null;
      bitrixFolderId?: string | null;
    },
  ): Promise<string> {
    if (equipment.bitrixFolderId) {
      return equipment.bitrixFolderId;
    }
    const docsId = await this.ensureDocsFolder(portal);
    const name = equipmentFolderName(equipment);
    let folderId: string;
    try {
      folderId = await this.findOrCreateSubfolder(portal, docsId, name);
    } catch (error) {
      const fallback = `${name} ${equipment.id.slice(0, 8)}`.slice(0, 180);
      this.logger.warn(
        `Папка «${name}» не создалась, пробуем «${fallback}»`,
        error as Error,
      );
      folderId = await this.findOrCreateSubfolder(portal, docsId, fallback);
    }

    await this.prisma.equipment.update({
      where: { id: equipment.id },
      data: { bitrixFolderId: folderId },
    });
    return folderId;
  }

  async renameEquipmentFolder(
    portal: PortalRow,
    folderId: string,
    equipment: {
      id: string;
      name: string;
      factoryNumber?: string | null;
      plateNumber?: string | null;
      category?: string | null;
    },
  ) {
    const name = equipmentFolderName(equipment);
    try {
      await this.call(portal, 'disk.folder.rename', {
        id: folderId,
        newName: name,
      });
    } catch (error) {
      this.logger.warn(
        `Не удалось переименовать папку Bitrix ${folderId}`,
        error as Error,
      );
    }
  }

  /**
   * Двухшаговая загрузка: сначала берём одноразовый uploadUrl, затем шлём файл
   * multipart-запросом. Base64 в теле REST-вызова раздувает файл примерно на
   * треть и на больших документах упирается в лимиты Битрикса.
   */
  async uploadToFolder(
    portal: PortalRow,
    folderId: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<string> {
    const prepared = await this.call(
      portal,
      'disk.folder.uploadfile',
      { id: folderId, generateUniqueName: true },
      60_000,
    );
    const uploadUrl = String(
      prepared.result?.uploadUrl || prepared.result?.UploadUrl || '',
    );
    const field = String(prepared.result?.field || 'file');
    if (!uploadUrl) {
      throw new ServiceUnavailableException(
        'Битрикс не вернул ссылку для загрузки файла',
      );
    }

    const form = new FormData();
    form.append(field, new Blob([new Uint8Array(buffer)]), fileName);

    const { data } = await axios.post(uploadUrl, form, {
      timeout: 600_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    if (data?.error) {
      throw new ServiceUnavailableException(
        `Битрикс отклонил файл: ${data.error_description || data.error}`,
      );
    }

    const fileId = String(
      data?.result?.ID || data?.result?.id || data?.result?.FILE?.ID || '',
    );
    if (!fileId) {
      throw new ServiceUnavailableException(
        'Битрикс не вернул ID загруженного файла',
      );
    }
    return fileId;
  }

  async downloadFile(
    portal: PortalRow,
    bitrixFileId: string,
  ): Promise<{ buffer: Buffer; name: string; mimeType: string }> {
    const meta = await this.call(portal, 'disk.file.get', { id: bitrixFileId });
    const result = meta.result || {};
    const name = String(result.NAME || result.name || 'document');
    const mimeType = String(
      result.DETAIL_URL ? result.CONTENT_TYPE || '' : result.CONTENT_TYPE || '',
    ) || 'application/octet-stream';
    let downloadUrl = String(
      result.DOWNLOAD_URL || result.downloadUrl || '',
    );
    if (!downloadUrl) {
      throw new ServiceUnavailableException(
        'Битрикс не вернул ссылку на скачивание файла',
      );
    }

    const opened = this.bitrix.decryptPortal(portal);
    if (!downloadUrl.includes('auth=')) {
      const sep = downloadUrl.includes('?') ? '&' : '?';
      downloadUrl = `${downloadUrl}${sep}auth=${encodeURIComponent(opened.accessToken)}`;
    }

    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 120_000,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });

    return {
      buffer: Buffer.from(response.data),
      name,
      mimeType: mimeType || 'application/octet-stream',
    };
  }

  async deleteFile(portal: PortalRow, bitrixFileId: string) {
    try {
      await this.call(portal, 'disk.file.delete', { id: bitrixFileId });
    } catch (error) {
      this.logger.warn(
        `Не удалось удалить файл Bitrix ${bitrixFileId}`,
        error as Error,
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { AssetCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiskService } from '../bitrix/disk.service';
import { equipmentFolderName } from '../bitrix/document.constants';
import { ExcelService } from '../excel/excel.service';
import { diffDocuments, diffIsEmpty, RemoteFile } from './document-diff';

type SyncableEquipment = {
  id: string;
  name: string;
  category: AssetCategory;
  factoryNumber: string | null;
  plateNumber: string | null;
  bitrixFolderId: string | null;
  hasDocuments: boolean;
};

export type SyncSummary = {
  ok: boolean;
  skipped: boolean;
  checked: number;
  changed: number;
  finishedAt: string;
};

const DOC_CATEGORIES: AssetCategory[] = ['EQUIPMENT', 'VEHICLE'];
const MIN_INTERVAL_MS = 2 * 60_000;
const FOLDER_CONCURRENCY = 4;

@Injectable()
export class DocumentsSyncService {
  private readonly logger = new Logger(DocumentsSyncService.name);
  private inFlight: Promise<SyncSummary> | null = null;
  private lastFinishedAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly disk: DiskService,
    private readonly excel: ExcelService,
  ) {}

  /** Reconciles every item with its Bitrix folder; throttled and deduplicated. */
  async syncAll(options: { force?: boolean } = {}): Promise<SyncSummary> {
    if (this.inFlight) {
      return this.inFlight;
    }
    const since = Date.now() - this.lastFinishedAt;
    if (!options.force && this.lastFinishedAt && since < MIN_INTERVAL_MS) {
      return this.summary({ skipped: true, checked: 0, changed: 0 });
    }

    this.inFlight = this.runAll().finally(() => {
      this.inFlight = null;
      this.lastFinishedAt = Date.now();
    });
    return this.inFlight;
  }

  /** Reconciles a single item, e.g. when its card is opened. */
  async syncEquipment(equipmentId: string): Promise<boolean> {
    const item = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: this.itemSelect(),
    });
    if (!item || !DOC_CATEGORIES.includes(item.category)) {
      return false;
    }

    const portal = await this.disk.requirePortal();
    const docsFolderId = portal.docsFolderId;
    if (!docsFolderId) {
      return this.clearFlagsWithoutFolders([item]).then((count) => count > 0);
    }

    const subfolders = await this.disk.listSubfolders(portal, docsFolderId);
    const folderId = this.matchFolderId(
      item,
      subfolders,
      new Set(subfolders.values()),
    );
    if (!folderId) {
      return this.applyMissingFolder(item);
    }
    if (folderId !== item.bitrixFolderId) {
      await this.prisma.equipment.update({
        where: { id: item.id },
        data: { bitrixFolderId: folderId },
      });
    }

    const files = await this.disk.listFolderFiles(portal, folderId);
    // Папка есть, но не читается — не трогаем данные, вернёмся позже.
    if (files === null) {
      return false;
    }
    const changed = await this.applyFiles(item, files);
    if (changed) {
      this.excel.scheduleSync();
    }
    return changed;
  }

  private itemSelect() {
    return {
      id: true,
      name: true,
      category: true,
      factoryNumber: true,
      plateNumber: true,
      bitrixFolderId: true,
      hasDocuments: true,
    } as const;
  }

  private summary(input: {
    skipped: boolean;
    checked: number;
    changed: number;
  }): SyncSummary {
    return {
      ok: true,
      skipped: input.skipped,
      checked: input.checked,
      changed: input.changed,
      finishedAt: new Date(this.lastFinishedAt || Date.now()).toISOString(),
    };
  }

  private async runAll(): Promise<SyncSummary> {
    const items = (await this.prisma.equipment.findMany({
      where: { category: { in: DOC_CATEGORIES } },
      select: this.itemSelect(),
    })) as SyncableEquipment[];

    if (!items.length) {
      return this.summary({ skipped: false, checked: 0, changed: 0 });
    }

    const portal = await this.disk.requirePortal();
    const docsFolderId = portal.docsFolderId;
    if (!docsFolderId) {
      const changed = await this.clearFlagsWithoutFolders(items);
      return this.summary({ skipped: false, checked: items.length, changed });
    }

    const subfolders = await this.disk.listSubfolders(portal, docsFolderId);
    const knownFolderIds = new Set(subfolders.values());
    let changed = 0;

    await this.mapLimit(items, FOLDER_CONCURRENCY, async (item) => {
      const folderId = this.matchFolderId(item, subfolders, knownFolderIds);
      if (!folderId) {
        if (await this.applyMissingFolder(item)) changed += 1;
        return;
      }
      if (folderId !== item.bitrixFolderId) {
        await this.prisma.equipment.update({
          where: { id: item.id },
          data: { bitrixFolderId: folderId },
        });
      }
      const files = await this.disk.listFolderFiles(portal, folderId);
      // Папка есть, но не читается — не трогаем данные, вернёмся позже.
      if (files === null) {
        return;
      }
      if (await this.applyFiles(item, files)) changed += 1;
    });

    if (changed) {
      this.excel.scheduleSync();
      this.logger.log(`Синхронизация документов: обновлено позиций ${changed}`);
    }
    return this.summary({ skipped: false, checked: items.length, changed });
  }

  private matchFolderId(
    item: SyncableEquipment,
    subfolders: Map<string, string>,
    knownFolderIds: Set<string>,
  ): string | null {
    if (item.bitrixFolderId && knownFolderIds.has(item.bitrixFolderId)) {
      return item.bitrixFolderId;
    }
    return subfolders.get(equipmentFolderName(item)) || null;
  }

  /**
   * Portal has no documents folder yet: only reset flags that cannot be backed
   * by files, keeping known rows intact in case the portal was reinstalled.
   */
  private async clearFlagsWithoutFolders(
    items: SyncableEquipment[],
  ): Promise<number> {
    const flagged = items.filter((item) => item.hasDocuments);
    if (!flagged.length) return 0;
    const withRows = await this.prisma.equipmentDocument.findMany({
      where: { equipmentId: { in: flagged.map((item) => item.id) } },
      select: { equipmentId: true },
      distinct: ['equipmentId'],
    });
    const keep = new Set(withRows.map((row) => row.equipmentId));
    const ids = flagged
      .filter((item) => !keep.has(item.id))
      .map((item) => item.id);
    if (!ids.length) return 0;
    await this.prisma.equipment.updateMany({
      where: { id: { in: ids } },
      data: { hasDocuments: false },
    });
    return ids.length;
  }

  /**
   * The documents folder has no subfolder for this item, so its files are gone.
   * The stale folder id is dropped as well, otherwise the next upload would
   * target a folder that no longer exists.
   */
  private async applyMissingFolder(item: SyncableEquipment): Promise<boolean> {
    const removed = await this.prisma.equipmentDocument.deleteMany({
      where: { equipmentId: item.id },
    });
    const needsFlag = item.hasDocuments;
    if (needsFlag || item.bitrixFolderId) {
      await this.prisma.equipment.update({
        where: { id: item.id },
        data: { hasDocuments: false, bitrixFolderId: null },
      });
    }
    return removed.count > 0 || needsFlag;
  }

  private async applyFiles(
    item: SyncableEquipment,
    files: RemoteFile[],
  ): Promise<boolean> {
    const local = await this.prisma.equipmentDocument.findMany({
      where: { equipmentId: item.id },
      select: {
        id: true,
        bitrixFileId: true,
        originalName: true,
        sizeBytes: true,
      },
    });
    const diff = diffDocuments(files, local);

    for (const file of diff.toAdd) {
      await this.prisma.equipmentDocument.upsert({
        where: { bitrixFileId: file.id },
        create: {
          equipmentId: item.id,
          originalName: file.name,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          bitrixFileId: file.id,
        },
        update: {
          equipmentId: item.id,
          originalName: file.name,
          sizeBytes: file.sizeBytes,
        },
      });
    }
    if (diff.toDeleteIds.length) {
      await this.prisma.equipmentDocument.deleteMany({
        where: { id: { in: diff.toDeleteIds } },
      });
    }
    for (const row of diff.toUpdate) {
      await this.prisma.equipmentDocument.update({
        where: { id: row.id },
        data: { originalName: row.originalName, sizeBytes: row.sizeBytes },
      });
    }
    if (diff.hasDocuments !== item.hasDocuments) {
      await this.prisma.equipment.update({
        where: { id: item.id },
        data: { hasDocuments: diff.hasDocuments },
      });
    }

    return !diffIsEmpty(diff) || diff.hasDocuments !== item.hasDocuments;
  }

  private async mapLimit<T>(
    list: T[],
    limit: number,
    worker: (item: T) => Promise<void>,
  ) {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, list.length) }, () =>
      (async () => {
        while (cursor < list.length) {
          const item = list[cursor++];
          try {
            await worker(item);
          } catch (error) {
            this.logger.warn(
              `Не удалось синхронизировать документы позиции`,
              error as Error,
            );
          }
        }
      })(),
    );
    await Promise.all(runners);
  }
}

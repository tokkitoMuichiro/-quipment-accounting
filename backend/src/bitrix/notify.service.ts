import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BitrixService } from './bitrix.service';

type BatchEntry = {
  actorName: string;
  kind: 'user' | 'warehouse';
  timer: NodeJS.Timeout;
};

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);
  private readonly batches = new Map<string, BatchEntry>();
  private readonly debounceMs = 90_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bitrix: BitrixService,
  ) {}

  scheduleIncomingTransfer(params: {
    recipientUserIds: string[];
    actorName: string;
    kind: 'user' | 'warehouse';
  }) {
    const actorName = params.actorName.trim() || 'Сотрудник';
    for (const userId of [...new Set(params.recipientUserIds.filter(Boolean))]) {
      const key = `${params.kind}:${userId}`;
      const existing = this.batches.get(key);
      if (existing) {
        clearTimeout(existing.timer);
      }
      const timer = setTimeout(() => {
        this.batches.delete(key);
        void this.flushIncoming(userId, actorName, params.kind);
      }, this.debounceMs);
      this.batches.set(key, { actorName, kind: params.kind, timer });
    }
  }

  async notifyFillRemark(params: {
    ownerUserId: string;
    equipmentName: string;
  }) {
    const text = `По позиции «${params.equipmentName}» есть замечание по заполнению. Откройте учёт оборудования, исправьте карточку и сохраните.`;
    await this.sendToUser(params.ownerUserId, text);
  }

  private async flushIncoming(
    userId: string,
    actorName: string,
    kind: 'user' | 'warehouse',
  ) {
    const text =
      kind === 'warehouse'
        ? `${actorName} передал(а) оборудование на вашу базу. Зайдите в учёт оборудования, чтобы подтвердить получение.`
        : `${actorName} передал(а) вам оборудование. Зайдите в учёт оборудования, чтобы подтвердить получение.`;
    await this.sendToUser(userId, text);
  }

  private async sendToUser(userId: string, message: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user?.notifyBitrix || !user.bitrixUserId) return;
      if (user.bitrixUserId.startsWith('dev:')) return;

      const portal = await this.prisma.bitrixPortal.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
      if (!portal) return;

      await this.bitrix.callWithPortal(portal, 'im.message.add', {
        DIALOG_ID: user.bitrixUserId,
        MESSAGE: message,
      });
    } catch (error: any) {
      this.logger.warn(
        `IM notify failed for ${userId}: ${error?.message || error}`,
      );
    }
  }
}

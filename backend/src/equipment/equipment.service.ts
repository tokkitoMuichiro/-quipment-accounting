import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Equipment,
  EquipmentType,
  OwnerType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelService } from '../excel/excel.service';
import {
  AuthUser,
  canActOnItem,
  canDeleteItem,
  canEditDocuments,
  canTransferFrom,
  isAdmin,
  canEditAllItems,
  isPrivilegedStaff,
  isWarehouseKeeper,
  keeperWarehouseIds,
  rolePermissions,
} from '../common/auth-user';
import { hasPermission } from '../common/permissions';
import {
  REPAIR_WAREHOUSE_NAME,
  REPAIR_WAREHOUSE_SLUG,
} from '../warehouses/repair-warehouse';
import { NotifyService } from '../bitrix/notify.service';
import {
  BulkTransferDto,
  CreateEquipmentDto,
  FlagFillDto,
  TransferEquipmentDto,
  UpdateEquipmentDto,
} from './equipment.dto';

const CONDITIONS_NEEDING_NOTE: Equipment['condition'][] = [
  'NEEDS_REPAIR',
  'IN_REPAIR',
  'IRREPARABLE',
];

const includeOwner = {
  ownerUser: true,
  ownerWarehouse: true,
  pendingTransfer: {
    include: {
      actor: { select: { id: true, fullName: true } },
    },
  },
} satisfies Prisma.EquipmentInclude;

type EquipmentWithOwner = Prisma.EquipmentGetPayload<{
  include: typeof includeOwner;
}>;

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excel: ExcelService,
    private readonly notify: NotifyService,
  ) {}

  private canSeeFillComment(user: AuthUser, item: { ownerUserId?: string | null }) {
    return isAdmin(user) || item.ownerUserId === user.id;
  }

  private sanitizeItem(item: EquipmentWithOwner, user: AuthUser) {
    if (this.canSeeFillComment(user, item)) {
      return item;
    }
    return { ...item, fillComment: null };
  }

  private assertFillAllowsTransfer(item: { fillStatus?: string | null }) {
    if (
      item.fillStatus === 'NEEDS_FIX' ||
      item.fillStatus === 'PENDING_REVIEW'
    ) {
      throw new BadRequestException(
        'Позиция на проверке заполнения. Сначала исправьте карточку и дождитесь подтверждения администратора',
      );
    }
  }
  private canViewAll(user: AuthUser) {
    return hasPermission(rolePermissions(user), 'view_all');
  }

  private async ensureRepairWarehouse() {
    const existing = await this.prisma.warehouse.findUnique({
      where: { slug: REPAIR_WAREHOUSE_SLUG },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.warehouse.create({
      data: {
        name: REPAIR_WAREHOUSE_NAME,
        slug: REPAIR_WAREHOUSE_SLUG,
        isSystem: true,
      },
    });
  }

  private normalizeConditionNote(
    condition: Equipment['condition'],
    note?: string | null,
  ) {
    if (condition === 'OK') {
      return null;
    }
    const text = note?.trim() || '';
    if (CONDITIONS_NEEDING_NOTE.includes(condition) && !text) {
      throw new BadRequestException(
        'Укажите пояснение: что случилось с оборудованием',
      );
    }
    return text || null;
  }

  private resolveConditionNote(
    item: Equipment,
    dto: UpdateEquipmentDto,
    nextCondition: Equipment['condition'],
  ) {
    if (nextCondition === 'OK') {
      return null;
    }
    if (dto.conditionNote !== undefined) {
      return this.normalizeConditionNote(nextCondition, dto.conditionNote);
    }
    if (dto.condition && dto.condition !== item.condition) {
      return this.normalizeConditionNote(nextCondition, dto.conditionNote);
    }
    return item.conditionNote;
  }

  private assertCanCreateFor(user: AuthUser, dto: CreateEquipmentDto) {
    const perms = rolePermissions(user);
    if (!hasPermission(perms, 'create')) {
      throw new ForbiddenException('Нет права создавать оборудование');
    }
    if (dto.condition === 'IN_REPAIR') {
      return;
    }
    if (this.canViewAll(user) || hasPermission(perms, 'manage_warehouses')) {
      return;
    }
    if (dto.ownerType === 'USER' && dto.ownerUserId === user.id) {
      return;
    }
    if (
      dto.ownerType === 'WAREHOUSE' &&
      dto.ownerWarehouseId &&
      isWarehouseKeeper(user, dto.ownerWarehouseId)
    ) {
      return;
    }
    throw new ForbiddenException(
      'Можно закреплять только за собой или за своей производственной базой',
    );
  }

  private visibleWhere(user: AuthUser): Prisma.EquipmentWhereInput {
    if (this.canViewAll(user)) {
      return {};
    }
    const warehouseIds = keeperWarehouseIds(user);
    return {
      OR: [
        { ownerUserId: user.id },
        warehouseIds.length
          ? { ownerWarehouseId: { in: warehouseIds } }
          : undefined,
        {
          pendingTransfer: {
            is: { status: 'PENDING', toUserId: user.id },
          },
        },
        warehouseIds.length
          ? {
              pendingTransfer: {
                is: {
                  status: 'PENDING',
                  toWarehouseId: { in: warehouseIds },
                },
              },
            }
          : undefined,
      ].filter(Boolean) as Prisma.EquipmentWhereInput[],
    };
  }

  list(
    user: AuthUser,
    scope?: string,
    warehouseId?: string,
    ownerUserId?: string,
  ) {
    const where: Prisma.EquipmentWhereInput = {};
    if (ownerUserId) {
      where.OR = [
        { ownerType: 'USER', ownerUserId },
        {
          pendingTransfer: {
            is: { status: 'PENDING', toUserId: ownerUserId },
          },
        },
      ];
    } else if (warehouseId) {
      where.OR = [
        { ownerType: 'WAREHOUSE', ownerWarehouseId: warehouseId },
        {
          pendingTransfer: {
            is: { status: 'PENDING', toWarehouseId: warehouseId },
          },
        },
      ];
    } else if (scope === 'mine') {
      where.OR = [
        { ownerType: 'USER', ownerUserId: user.id },
        {
          pendingTransfer: {
            is: { status: 'PENDING', toUserId: user.id },
          },
        },
      ];
    } else {
      Object.assign(where, this.visibleWhere(user));
    }
    return this.prisma.equipment
      .findMany({
        where,
        include: includeOwner,
        orderBy: [{ name: 'asc' }, { factoryNumber: 'asc' }],
      })
      .then((items) =>
        this.sortByFillPriority(items).map((item) =>
          this.sanitizeItem(item, user),
        ),
      );
  }

  private sortByFillPriority<T extends { fillStatus?: string | null; name: string; factoryNumber?: string | null }>(
    items: T[],
  ): T[] {
    const rank = (status?: string | null) => {
      if (status === 'NEEDS_FIX') return 0;
      if (status === 'PENDING_REVIEW') return 1;
      return 2;
    };
    return [...items].sort((a, b) => {
      const byFill = rank(a.fillStatus) - rank(b.fillStatus);
      if (byFill !== 0) return byFill;
      const byName = a.name.localeCompare(b.name, 'ru');
      if (byName !== 0) return byName;
      return (a.factoryNumber || '').localeCompare(b.factoryNumber || '', 'ru');
    });
  }

  async alerts(user: AuthUser) {
    const warehouseIds = keeperWarehouseIds(user);
    const pendingWhere: Prisma.EquipmentWhereInput = {
      OR: [
        {
          pendingTransfer: {
            is: { status: 'PENDING', toUserId: user.id },
          },
        },
        warehouseIds.length
          ? {
              pendingTransfer: {
                is: {
                  status: 'PENDING',
                  toWarehouseId: { in: warehouseIds },
                },
              },
            }
          : undefined,
      ].filter(Boolean) as Prisma.EquipmentWhereInput[],
    };

    const [pendingAccept, needsFix, pendingReview] = await Promise.all([
      this.prisma.equipment.count({ where: pendingWhere }),
      this.prisma.equipment.count({
        where: {
          fillStatus: 'NEEDS_FIX',
          ownerType: 'USER',
          ownerUserId: user.id,
        },
      }),
      isAdmin(user)
        ? this.prisma.equipment.count({
            where: { fillStatus: 'PENDING_REVIEW' },
          })
        : Promise.resolve(0),
    ]);

    return {
      pendingAccept,
      needsFix,
      pendingReview,
    };
  }

  async get(id: string, user: AuthUser) {
    const item = await this.prisma.equipment.findUnique({
      where: { id },
      include: includeOwner,
    });
    if (!item) {
      throw new NotFoundException('Оборудование не найдено');
    }
    return this.sanitizeItem(item, user);
  }

  private normalizeCreate(dto: CreateEquipmentDto) {
    if (dto.type === 'SERIAL') {
      if (!dto.factoryNumber?.trim()) {
        throw new BadRequestException(
          'Для серийного оборудования нужен заводской номер',
        );
      }
      return {
        ...dto,
        factoryNumber: dto.factoryNumber.trim(),
        quantity: 1,
      };
    }
    return {
      ...dto,
      factoryNumber: null as string | null,
      quantity: dto.quantity && dto.quantity > 0 ? dto.quantity : 1,
    };
  }

  async create(dto: CreateEquipmentDto, user: AuthUser) {
    this.assertCanCreateFor(user, dto);
    const data = this.normalizeCreate(dto);
    const conditionNote = this.normalizeConditionNote(
      data.condition,
      dto.conditionNote,
    );

    let ownerType = data.ownerType;
    let ownerUserId = data.ownerUserId ?? null;
    let ownerWarehouseId = data.ownerWarehouseId ?? null;

    if (data.condition === 'IN_REPAIR') {
      const repair = await this.ensureRepairWarehouse();
      ownerType = 'WAREHOUSE';
      ownerUserId = null;
      ownerWarehouseId = repair.id;
    }

    if (ownerType === 'USER' && !ownerUserId) {
      throw new BadRequestException('Укажите владельца');
    }
    if (ownerType === 'WAREHOUSE' && !ownerWarehouseId) {
      throw new BadRequestException('Укажите производственную базу');
    }

    if (data.type === EquipmentType.CONSUMABLE) {
      const existing = await this.findConsumableLot(
        data.name.trim(),
        data.condition,
        ownerType,
        ownerUserId,
        ownerWarehouseId,
      );
      if (existing) {
        const item = await this.prisma.equipment.update({
          where: { id: existing.id },
          data: {
            quantity: { increment: data.quantity },
            conditionNote: conditionNote ?? existing.conditionNote,
            hasDocuments: existing.hasDocuments || Boolean(dto.hasDocuments),
          },
          include: includeOwner,
        });
        this.excel.scheduleSync();
        return item;
      }
    }

    const item = await this.prisma.equipment.create({
      data: {
        name: data.name.trim(),
        type: data.type,
        factoryNumber: data.factoryNumber,
        quantity: data.quantity,
        condition: data.condition,
        conditionNote,
        hasDocuments: Boolean(dto.hasDocuments),
        ownerType,
        ownerUserId: ownerType === 'USER' ? ownerUserId : null,
        ownerWarehouseId: ownerType === 'WAREHOUSE' ? ownerWarehouseId : null,
      },
      include: includeOwner,
    });
    this.excel.scheduleSync();
    return item;
  }

  async update(id: string, dto: UpdateEquipmentDto, user: AuthUser) {
    const item = await this.get(id, user);
    const perms = rolePermissions(user);
    const canFullEdit = canEditAllItems(user);
    const canEditOwn =
      hasPermission(perms, 'edit') && canActOnItem(user, item);
    const canEditCondition = hasPermission(perms, 'edit_condition');
    const fillOpen =
      item.fillStatus === 'NEEDS_FIX' || item.fillStatus === 'PENDING_REVIEW';
    const canOwnerFixCard =
      !canFullEdit && !canEditOwn && fillOpen && canActOnItem(user, item);
    const canEditCard = canFullEdit || canEditOwn || canOwnerFixCard;
    const wantsCard =
      dto.name !== undefined ||
      dto.type !== undefined ||
      dto.factoryNumber !== undefined ||
      dto.quantity !== undefined;
    const wantsCondition =
      dto.condition !== undefined || dto.conditionNote !== undefined;
    const wantsDocs = dto.hasDocuments !== undefined;

    if (wantsCard && !canEditCard) {
      throw new ForbiddenException('Нет права редактировать карточку');
    }
    if (wantsCondition) {
      if (!canFullEdit && !canEditCondition) {
        throw new ForbiddenException('Нет права менять состояние');
      }
      if (!canFullEdit && !canActOnItem(user, item)) {
        throw new ForbiddenException(
          'Можно менять состояние только своего оборудования или оборудования своей базы',
        );
      }
    }
    if (wantsDocs && !canEditDocuments(user, item) && !canOwnerFixCard) {
      throw new ForbiddenException(
        'Паспорта и сертификаты можно отмечать только у своего оборудования или на своей базе',
      );
    }
    if (!wantsCard && !wantsCondition && !wantsDocs) {
      return item;
    }

    const nextType = dto.type ?? item.type;
    if (dto.type !== undefined && dto.type !== item.type && !canEditCard) {
      throw new ForbiddenException('Нет права менять тип оборудования');
    }
    if (nextType === 'SERIAL') {
      const factoryNumber =
        dto.factoryNumber !== undefined
          ? dto.factoryNumber.trim()
          : item.factoryNumber || '';
      if (!factoryNumber) {
        throw new BadRequestException(
          'Для серийного оборудования нужен заводской номер',
        );
      }
      if (dto.quantity !== undefined && dto.quantity !== 1) {
        throw new BadRequestException('Серийная единица всегда 1 шт.');
      }
    }
    if (nextType === 'CONSUMABLE' && dto.factoryNumber?.trim()) {
      throw new BadRequestException(
        'У неномерного оборудования нет заводского номера',
      );
    }

    const nextCondition = dto.condition ?? item.condition;
    const conditionNote = wantsCondition
      ? this.resolveConditionNote(item, dto, nextCondition)
      : undefined;

    if (item.pendingTransferId && wantsCondition) {
      throw new BadRequestException(
        'Сначала отмените передачу или дождитесь принятия',
      );
    }
    if (
      item.pendingTransferId &&
      dto.quantity !== undefined &&
      dto.quantity !== item.quantity
    ) {
      throw new BadRequestException(
        'Сначала отмените передачу или дождитесь принятия',
      );
    }
    if (item.pendingTransferId && dto.type !== undefined && dto.type !== item.type) {
      throw new BadRequestException(
        'Сначала отмените передачу или дождитесь принятия',
      );
    }

    const markPendingReview = Boolean(
      fillOpen &&
        !canFullEdit &&
        canActOnItem(user, item) &&
        (wantsCard || wantsDocs),
    );

    const resultId = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.equipment.update({
        where: { id },
        data: {
          name: canEditCard ? dto.name?.trim() : undefined,
          type: canEditCard && dto.type !== undefined ? nextType : undefined,
          factoryNumber: !canEditCard
            ? undefined
            : nextType === 'SERIAL'
              ? (dto.factoryNumber !== undefined
                  ? dto.factoryNumber.trim() || null
                  : undefined)
              : null,
          quantity: !canEditCard
            ? undefined
            : nextType === 'SERIAL'
              ? 1
              : dto.quantity !== undefined
                ? dto.quantity
                : undefined,
          condition: wantsCondition ? nextCondition : undefined,
          conditionNote,
          hasDocuments: wantsDocs ? dto.hasDocuments : undefined,
          ...(markPendingReview
            ? {
                fillStatus: 'PENDING_REVIEW' as const,
                fillComment: null,
              }
            : {}),
        },
      });

      if (wantsCondition && nextCondition === 'IN_REPAIR') {
        const repair = await this.ensureRepairWarehouseTx(tx);
        if (updated.ownerWarehouseId !== repair.id) {
          return this.transferInTx(
            tx,
            updated.id,
            {
              toOwnerType: 'WAREHOUSE',
              toWarehouseId: repair.id,
            },
            user,
            { systemRepairMove: true },
          );
        }
      }

      return updated.id;
    });

    this.excel.scheduleSync();
    return this.get(resultId, user);
  }

  async remove(id: string, user: AuthUser) {
    const item = await this.get(id, user);
    if (!canDeleteItem(user, item)) {
      throw new ForbiddenException(
        'Можно удалять только своё оборудование или оборудование своей базы',
      );
    }
    if (item.pendingTransferId) {
      throw new BadRequestException(
        'Сначала отмените передачу или дождитесь принятия',
      );
    }
    await this.prisma.equipment.delete({ where: { id } });
    this.excel.scheduleSync();
    return { ok: true };
  }

  async transfer(id: string, dto: TransferEquipmentDto, user: AuthUser) {
    if (!hasPermission(rolePermissions(user), 'transfer')) {
      throw new ForbiddenException('Нет права передавать');
    }

    if (dto.toOwnerType === 'USER') {
      const resultId = await this.prisma.$transaction((tx) =>
        this.offerPendingInTx(tx, id, dto, user),
      );
      this.excel.scheduleSync();
      return this.get(resultId, user);
    }

    if (dto.toOwnerType === 'WAREHOUSE') {
      if (!dto.toWarehouseId) {
        throw new BadRequestException('Укажите производственную базу');
      }
      const dest = await this.prisma.warehouse.findUnique({
        where: { id: dto.toWarehouseId },
      });
      if (!dest) {
        throw new BadRequestException('Производственная база не найдена');
      }
      // На «Ремонт» — сразу; на обычную базу — ждёт принятия кладовщиком.
      if (dest.slug !== REPAIR_WAREHOUSE_SLUG) {
        const resultId = await this.prisma.$transaction((tx) =>
          this.offerPendingInTx(tx, id, dto, user),
        );
        this.excel.scheduleSync();
        return this.get(resultId, user);
      }
    }

    const resultId = await this.prisma.$transaction((tx) =>
      this.transferInTx(tx, id, dto, user),
    );

    this.excel.scheduleSync();
    return this.get(resultId, user);
  }

  async acceptTransfer(id: string, user: AuthUser) {
    const item = await this.get(id, user);
    const pending = item.pendingTransfer;
    if (!pending || pending.status !== 'PENDING') {
      throw new BadRequestException('Нет передачи, ожидающей принятия');
    }

    const canAcceptUser =
      pending.toOwnerType === 'USER' && pending.toUserId === user.id;
    const canAcceptWarehouse =
      pending.toOwnerType === 'WAREHOUSE' &&
      Boolean(pending.toWarehouseId) &&
      isWarehouseKeeper(user, pending.toWarehouseId!);
    if (!canAcceptUser && !canAcceptWarehouse && !isPrivilegedStaff(user)) {
      throw new ForbiddenException(
        pending.toOwnerType === 'WAREHOUSE'
          ? 'Принять может кладовщик этой базы'
          : 'Принять может только получатель',
      );
    }

    const resultId = await this.prisma.$transaction((tx) =>
      this.transferInTx(
        tx,
        id,
        {
          toOwnerType: pending.toOwnerType,
          toUserId: pending.toUserId || undefined,
          toWarehouseId: pending.toWarehouseId || undefined,
          quantity: pending.quantity,
        },
        user,
        { applyExistingTransferId: pending.id },
      ),
    );

    this.excel.scheduleSync();
    return this.get(resultId, user);
  }

  async cancelPendingTransfer(id: string, user: AuthUser) {
    const item = await this.get(id, user);
    const pending = item.pendingTransfer;
    if (!pending || pending.status !== 'PENDING') {
      throw new BadRequestException('Нет передачи, ожидающей принятия');
    }
    const canCancel =
      pending.actorUserId === user.id ||
      isPrivilegedStaff(user) ||
      canTransferFrom(user, item);
    if (!canCancel) {
      throw new ForbiddenException('Отменить может тот, кто передавал');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.equipment.update({
        where: { id: item.id },
        data: { pendingTransferId: null },
      });
      await tx.transfer.update({
        where: { id: pending.id },
        data: { status: 'CANCELLED' },
      });
    });
    this.excel.scheduleSync();
    return this.get(id, user);
  }

  async flagFill(id: string, dto: FlagFillDto, user: AuthUser) {
    if (!isAdmin(user)) {
      throw new ForbiddenException('Помечать заполнение может только администратор');
    }
    const item = await this.get(id, user);
    if (item.pendingTransferId) {
      throw new BadRequestException(
        'Сначала отмените передачу или дождитесь принятия',
      );
    }
    const comment = dto.comment.trim();
    if (comment.length < 3) {
      throw new BadRequestException('Укажите комментарий к замечанию');
    }

    await this.prisma.equipment.update({
      where: { id: item.id },
      data: {
        fillStatus: 'NEEDS_FIX',
        fillComment: comment,
        flaggedById: user.id,
        flaggedAt: new Date(),
      },
    });

    if (item.ownerType === 'USER' && item.ownerUserId) {
      void this.notify.notifyFillRemark({
        ownerUserId: item.ownerUserId,
        equipmentName: item.name,
      });
    }

    this.excel.scheduleSync();
    return this.get(id, user);
  }

  async confirmFill(id: string, user: AuthUser) {
    if (!isAdmin(user)) {
      throw new ForbiddenException('Подтвердить заполнение может только администратор');
    }
    const item = await this.get(id, user);
    if (item.fillStatus === 'OK') {
      return item;
    }
    await this.prisma.equipment.update({
      where: { id: item.id },
      data: {
        fillStatus: 'OK',
        fillComment: null,
        flaggedById: null,
        flaggedAt: null,
      },
    });
    this.excel.scheduleSync();
    return this.get(id, user);
  }

  private async offerPendingInTx(
    tx: Prisma.TransactionClient,
    id: string,
    dto: TransferEquipmentDto,
    user: AuthUser,
  ) {
    const item = await tx.equipment.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Оборудование не найдено');
    }
    this.assertCanTransferFrom(user, item);
    this.assertFillAllowsTransfer(item);
    if (item.pendingTransferId) {
      throw new BadRequestException(
        'Эта позиция уже ожидает принятия. Отмените передачу или дождитесь получателя',
      );
    }

    if (dto.toOwnerType === 'USER') {
      if (!dto.toUserId) {
        throw new BadRequestException('Укажите получателя');
      }
      const recipient = await tx.user.findUnique({ where: { id: dto.toUserId } });
      if (!recipient) {
        throw new BadRequestException('Получатель не найден');
      }
      if (item.ownerType === 'USER' && item.ownerUserId === dto.toUserId) {
        throw new BadRequestException('Уже находится у этого владельца');
      }
    } else if (dto.toOwnerType === 'WAREHOUSE') {
      if (!dto.toWarehouseId) {
        throw new BadRequestException('Укажите производственную базу');
      }
      const dest = await tx.warehouse.findUnique({
        where: { id: dto.toWarehouseId },
      });
      if (!dest) {
        throw new BadRequestException('Производственная база не найдена');
      }
      if (dest.slug === REPAIR_WAREHOUSE_SLUG) {
        throw new BadRequestException(
          'На базу «Ремонт» передача выполняется сразу, без принятия',
        );
      }
      if (
        item.ownerType === 'WAREHOUSE' &&
        item.ownerWarehouseId === dto.toWarehouseId
      ) {
        throw new BadRequestException('Уже находится у этого владельца');
      }
    } else {
      throw new BadRequestException('Укажите получателя');
    }

    const qty =
      item.type === 'SERIAL'
        ? 1
        : dto.quantity && dto.quantity > 0
          ? dto.quantity
          : item.quantity;
    if (qty > item.quantity) {
      throw new BadRequestException('Недостаточно количества');
    }

    const fromLabel = await this.ownerLabelTx(
      tx,
      item.ownerType,
      item.ownerUserId,
      item.ownerWarehouseId,
    );
    const toLabel = await this.ownerLabelTx(
      tx,
      dto.toOwnerType,
      dto.toUserId,
      dto.toWarehouseId,
    );

    const pending = await tx.transfer.create({
      data: {
        equipmentId: item.id,
        equipmentName: item.name,
        factoryNumber: item.factoryNumber,
        quantity: qty,
        status: 'PENDING',
        fromOwnerType: item.ownerType,
        fromUserId: item.ownerUserId,
        fromWarehouseId: item.ownerWarehouseId,
        fromLabel,
        toOwnerType: dto.toOwnerType,
        toUserId: dto.toOwnerType === 'USER' ? dto.toUserId : null,
        toWarehouseId:
          dto.toOwnerType === 'WAREHOUSE' ? dto.toWarehouseId : null,
        toLabel,
        actorUserId: user.id,
      },
    });

    await tx.equipment.update({
      where: { id: item.id },
      data: { pendingTransferId: pending.id },
    });

    if (dto.toOwnerType === 'USER' && dto.toUserId) {
      this.notify.scheduleIncomingTransfer({
        recipientUserIds: [dto.toUserId],
        actorName: user.fullName,
        kind: 'user',
      });
    } else if (dto.toOwnerType === 'WAREHOUSE' && dto.toWarehouseId) {
      const keepers = await tx.warehouseKeeper.findMany({
        where: { warehouseId: dto.toWarehouseId },
        select: { userId: true },
      });
      this.notify.scheduleIncomingTransfer({
        recipientUserIds: keepers.map((k) => k.userId),
        actorName: user.fullName,
        kind: 'warehouse',
      });
    }

    return item.id;
  }

  private async ensureRepairWarehouseTx(tx: Prisma.TransactionClient) {
    const existing = await tx.warehouse.findUnique({
      where: { slug: REPAIR_WAREHOUSE_SLUG },
    });
    if (existing) {
      return existing;
    }
    return tx.warehouse.create({
      data: {
        name: REPAIR_WAREHOUSE_NAME,
        slug: REPAIR_WAREHOUSE_SLUG,
        isSystem: true,
      },
    });
  }

  private async transferInTx(
    tx: Prisma.TransactionClient,
    id: string,
    dto: TransferEquipmentDto,
    user: AuthUser,
    options?: { systemRepairMove?: boolean; applyExistingTransferId?: string },
  ) {
    const item = await tx.equipment.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Оборудование не найдено');
    }

    if (item.pendingTransferId && !options?.applyExistingTransferId) {
      throw new BadRequestException(
        'Сначала отмените передачу или дождитесь принятия',
      );
    }
    if (
      options?.applyExistingTransferId &&
      item.pendingTransferId !== options.applyExistingTransferId
    ) {
      throw new BadRequestException('Нет передачи, ожидающей принятия');
    }

    if (!options?.systemRepairMove && !options?.applyExistingTransferId) {
      this.assertCanTransferFrom(user, item);
      this.assertFillAllowsTransfer(item);
    }

    if (dto.toOwnerType === 'USER' && !dto.toUserId) {
      throw new BadRequestException('Укажите получателя');
    }
    if (dto.toOwnerType === 'WAREHOUSE' && !dto.toWarehouseId) {
      throw new BadRequestException('Укажите производственную базу');
    }

    const sameOwner =
      (item.ownerType === 'USER' &&
        dto.toOwnerType === 'USER' &&
        item.ownerUserId === dto.toUserId) ||
      (item.ownerType === 'WAREHOUSE' &&
        dto.toOwnerType === 'WAREHOUSE' &&
        item.ownerWarehouseId === dto.toWarehouseId);

    if (sameOwner) {
      throw new BadRequestException('Уже находится у этого владельца');
    }

    const qty =
      item.type === 'SERIAL'
        ? 1
        : dto.quantity && dto.quantity > 0
          ? dto.quantity
          : item.quantity;

    if (qty > item.quantity) {
      throw new BadRequestException('Недостаточно количества');
    }

    const fromLabel = await this.ownerLabelTx(
      tx,
      item.ownerType,
      item.ownerUserId,
      item.ownerWarehouseId,
    );
    const toLabel = await this.ownerLabelTx(
      tx,
      dto.toOwnerType,
      dto.toUserId,
      dto.toWarehouseId,
    );

    if (options?.applyExistingTransferId) {
      await tx.equipment.update({
        where: { id: item.id },
        data: { pendingTransferId: null },
      });
    }

    let remainingId = item.id;

    if (item.type === 'SERIAL' || qty === item.quantity) {
      const dest = await this.findConsumableLotTx(
        tx,
        item.name,
        item.condition,
        dto.toOwnerType,
        dto.toUserId,
        dto.toWarehouseId,
        item.id,
      );

      if (item.type === 'CONSUMABLE' && dest) {
        const moved = await tx.equipment.deleteMany({
          where: { id: item.id, quantity: qty },
        });
        if (moved.count !== 1) {
          throw new BadRequestException('Недостаточно количества');
        }
        await tx.equipment.update({
          where: { id: dest.id },
          data: { quantity: { increment: qty } },
        });
        remainingId = dest.id;
      } else {
        const moved = await tx.equipment.updateMany({
          where: { id: item.id, quantity: item.quantity },
          data: {
            ownerType: dto.toOwnerType,
            ownerUserId: dto.toOwnerType === 'USER' ? dto.toUserId : null,
            ownerWarehouseId:
              dto.toOwnerType === 'WAREHOUSE' ? dto.toWarehouseId : null,
          },
        });
        if (moved.count !== 1) {
          throw new BadRequestException('Недостаточно количества');
        }
      }
    } else {
      const decremented = await tx.equipment.updateMany({
        where: { id: item.id, quantity: { gte: qty } },
        data: { quantity: { decrement: qty } },
      });
      if (decremented.count !== 1) {
        throw new BadRequestException('Недостаточно количества');
      }

      const dest = await this.findConsumableLotTx(
        tx,
        item.name,
        item.condition,
        dto.toOwnerType,
        dto.toUserId,
        dto.toWarehouseId,
      );

      if (dest) {
        await tx.equipment.update({
          where: { id: dest.id },
          data: { quantity: { increment: qty } },
        });
        remainingId = dest.id;
      } else {
        const created = await tx.equipment.create({
          data: {
            name: item.name,
            type: 'CONSUMABLE',
            factoryNumber: null,
            quantity: qty,
            condition: item.condition,
            conditionNote: item.conditionNote,
            hasDocuments: item.hasDocuments,
            ownerType: dto.toOwnerType,
            ownerUserId: dto.toOwnerType === 'USER' ? dto.toUserId : null,
            ownerWarehouseId:
              dto.toOwnerType === 'WAREHOUSE' ? dto.toWarehouseId : null,
          },
        });
        remainingId = created.id;
      }
    }

    if (options?.applyExistingTransferId) {
      await tx.transfer.update({
        where: { id: options.applyExistingTransferId },
        data: {
          status: 'COMPLETED',
          equipmentId: remainingId,
        },
      });
    } else {
      await tx.transfer.create({
        data: {
          equipmentId: remainingId,
          equipmentName: item.name,
          factoryNumber: item.factoryNumber,
          quantity: qty,
          status: 'COMPLETED',
          fromOwnerType: item.ownerType,
          fromUserId: item.ownerUserId,
          fromWarehouseId: item.ownerWarehouseId,
          fromLabel,
          toOwnerType: dto.toOwnerType,
          toUserId: dto.toUserId || null,
          toWarehouseId: dto.toWarehouseId || null,
          toLabel,
          actorUserId: user.id,
        },
      });
    }

    return remainingId;
  }

  async bulkTransfer(dto: BulkTransferDto, user: AuthUser) {
    const results: Array<Prisma.EquipmentGetPayload<{ include: typeof includeOwner }>> =
      [];
    const failed: Array<{ id: string; message: string }> = [];
    for (const id of dto.ids) {
      try {
        const item = await this.transfer(
          id,
          {
            toOwnerType: dto.toOwnerType,
            toUserId: dto.toUserId,
            toWarehouseId: dto.toWarehouseId,
          },
          user,
        );
        if (item) {
          results.push(item);
        }
      } catch (error: any) {
        failed.push({ id, message: error?.message || 'Не удалось передать' });
      }
    }
    return { transferred: results.length, failed, results };
  }

  private assertCanTransferFrom(user: AuthUser, item: Equipment) {
    if (canTransferFrom(user, item)) {
      return;
    }
    throw new ForbiddenException(
      'Можно передавать только своё оборудование. С базы его выдаёт кладовщик этой базы или администратор',
    );
  }

  private async ownerLabelTx(
    tx: Prisma.TransactionClient,
    type: OwnerType,
    userId?: string | null,
    warehouseId?: string | null,
  ) {
    if (type === 'USER') {
      const u = userId
        ? await tx.user.findUnique({ where: { id: userId } })
        : null;
      return u?.fullName || 'Сотрудник';
    }
    const w = warehouseId
      ? await tx.warehouse.findUnique({ where: { id: warehouseId } })
      : null;
    return w ? `База: ${w.name}` : 'Производственная база';
  }

  private findConsumableLot(
    name: string,
    condition: Equipment['condition'],
    ownerType: OwnerType,
    ownerUserId?: string | null,
    ownerWarehouseId?: string | null,
  ) {
    return this.prisma.equipment.findFirst({
      where: {
        type: 'CONSUMABLE',
        name,
        condition,
        ownerType,
        ownerUserId: ownerType === 'USER' ? ownerUserId : null,
        ownerWarehouseId: ownerType === 'WAREHOUSE' ? ownerWarehouseId : null,
      },
    });
  }

  private findConsumableLotTx(
    tx: Prisma.TransactionClient,
    name: string,
    condition: Equipment['condition'],
    ownerType: OwnerType,
    ownerUserId?: string | null,
    ownerWarehouseId?: string | null,
    excludeId?: string,
  ) {
    return tx.equipment.findFirst({
      where: {
        type: 'CONSUMABLE',
        name,
        condition,
        ownerType,
        ownerUserId: ownerType === 'USER' ? ownerUserId : null,
        ownerWarehouseId: ownerType === 'WAREHOUSE' ? ownerWarehouseId : null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  listTransfers(user: AuthUser) {
    const where: Prisma.TransferWhereInput = {};
    if (!this.canViewAll(user)) {
      const warehouseIds = keeperWarehouseIds(user);
      where.OR = [
        { actorUserId: user.id },
        { fromUserId: user.id },
        { toUserId: user.id },
        warehouseIds.length
          ? { fromWarehouseId: { in: warehouseIds } }
          : undefined,
        warehouseIds.length
          ? { toWarehouseId: { in: warehouseIds } }
          : undefined,
      ].filter(Boolean) as Prisma.TransferWhereInput[];
    }

    return this.prisma.transfer.findMany({
      where,
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }
}

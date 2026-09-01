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
  canTransferFrom,
  isWarehouseKeeper,
  keeperWarehouseIds,
  rolePermissions,
} from '../common/auth-user';
import { hasPermission } from '../common/permissions';
import {
  REPAIR_WAREHOUSE_NAME,
  REPAIR_WAREHOUSE_SLUG,
} from '../warehouses/repair-warehouse';
import {
  BulkTransferDto,
  CreateEquipmentDto,
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
} satisfies Prisma.EquipmentInclude;

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excel: ExcelService,
  ) {}

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

  private canManageItem(user: AuthUser, item: Equipment) {
    const perms = rolePermissions(user);
    if (hasPermission(perms, 'edit') || hasPermission(perms, 'view_all')) {
      return hasPermission(perms, 'edit') || hasPermission(perms, 'delete');
    }
    if (item.ownerType === 'USER' && item.ownerUserId === user.id) {
      return true;
    }
    if (
      item.ownerType === 'WAREHOUSE' &&
      item.ownerWarehouseId &&
      isWarehouseKeeper(user, item.ownerWarehouseId)
    ) {
      return true;
    }
    return false;
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
      where.ownerType = 'USER';
      where.ownerUserId = ownerUserId;
    } else if (warehouseId) {
      where.ownerType = 'WAREHOUSE';
      where.ownerWarehouseId = warehouseId;
    } else if (scope === 'mine') {
      where.ownerType = 'USER';
      where.ownerUserId = user.id;
    } else {
      Object.assign(where, this.visibleWhere(user));
    }
    return this.prisma.equipment.findMany({
      where,
      include: includeOwner,
      orderBy: [{ name: 'asc' }, { factoryNumber: 'asc' }],
    });
  }

  async get(id: string, _user: AuthUser) {
    const item = await this.prisma.equipment.findUnique({
      where: { id },
      include: includeOwner,
    });
    if (!item) {
      throw new NotFoundException('Оборудование не найдено');
    }
    return item;
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

    try {
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
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException(
          'Заводской номер уже есть в учёте',
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateEquipmentDto, user: AuthUser) {
    const item = await this.get(id, user);
    const perms = rolePermissions(user);
    const canFullEdit = hasPermission(perms, 'edit');
    const canEditCondition = hasPermission(perms, 'edit_condition');
    const wantsCard =
      dto.name !== undefined ||
      dto.factoryNumber !== undefined ||
      dto.quantity !== undefined;
    const wantsCondition =
      dto.condition !== undefined || dto.conditionNote !== undefined;
    const wantsDocs = dto.hasDocuments !== undefined;

    if (wantsCard && !canFullEdit) {
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
    if (!wantsCard && !wantsCondition && !wantsDocs) {
      return item;
    }

    if (item.type === 'SERIAL' && dto.quantity && dto.quantity !== 1) {
      throw new BadRequestException('Серийная единица всегда 1 шт.');
    }
    if (item.type === 'CONSUMABLE' && dto.factoryNumber) {
      throw new BadRequestException('У расходников нет заводского номера');
    }

    const nextCondition = dto.condition ?? item.condition;
    const conditionNote = wantsCondition
      ? this.resolveConditionNote(item, dto, nextCondition)
      : undefined;

    try {
      const updated = await this.prisma.equipment.update({
        where: { id },
        data: {
          name: canFullEdit ? dto.name?.trim() : undefined,
          factoryNumber:
            !canFullEdit || dto.factoryNumber === undefined
              ? undefined
              : dto.factoryNumber.trim() || null,
          quantity: canFullEdit ? dto.quantity : undefined,
          condition: wantsCondition ? nextCondition : undefined,
          conditionNote,
          hasDocuments: wantsDocs ? dto.hasDocuments : undefined,
        },
        include: includeOwner,
      });

      if (wantsCondition && nextCondition === 'IN_REPAIR') {
        const repair = await this.ensureRepairWarehouse();
        if (updated.ownerWarehouseId !== repair.id) {
          return this.transfer(
            updated.id,
            {
              toOwnerType: 'WAREHOUSE',
              toWarehouseId: repair.id,
            },
            user,
          );
        }
      }

      this.excel.scheduleSync();
      return updated;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException('Заводской номер уже есть в учёте');
      }
      throw error;
    }
  }

  async remove(id: string, user: AuthUser) {
    const item = await this.get(id, user);
    if (!hasPermission(rolePermissions(user), 'delete')) {
      throw new ForbiddenException('Нет права удалять');
    }
    await this.prisma.equipment.delete({ where: { id } });
    this.excel.scheduleSync();
    return { ok: true };
  }

  async transfer(id: string, dto: TransferEquipmentDto, user: AuthUser) {
    if (!hasPermission(rolePermissions(user), 'transfer')) {
      throw new ForbiddenException('Нет права передавать');
    }

    const item = await this.get(id, user);
    this.assertCanTransferFrom(user, item);

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
      item.type === 'SERIAL' ? 1 : dto.quantity && dto.quantity > 0 ? dto.quantity : item.quantity;

    if (qty > item.quantity) {
      throw new BadRequestException('Недостаточно количества');
    }

    const fromLabel = await this.ownerLabel(
      item.ownerType,
      item.ownerUserId,
      item.ownerWarehouseId,
    );
    const toLabel = await this.ownerLabel(
      dto.toOwnerType,
      dto.toUserId,
      dto.toWarehouseId,
    );

    const result = await this.prisma.$transaction(async (tx) => {
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
          await tx.equipment.update({
            where: { id: dest.id },
            data: { quantity: { increment: qty } },
          });
          await tx.equipment.delete({ where: { id: item.id } });
          remainingId = dest.id;
        } else {
          await tx.equipment.update({
            where: { id: item.id },
            data: {
              ownerType: dto.toOwnerType,
              ownerUserId: dto.toOwnerType === 'USER' ? dto.toUserId : null,
              ownerWarehouseId:
                dto.toOwnerType === 'WAREHOUSE' ? dto.toWarehouseId : null,
            },
          });
        }
      } else {
        await tx.equipment.update({
          where: { id: item.id },
          data: { quantity: { decrement: qty } },
        });

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
              ownerType: dto.toOwnerType,
              ownerUserId: dto.toOwnerType === 'USER' ? dto.toUserId : null,
              ownerWarehouseId:
                dto.toOwnerType === 'WAREHOUSE' ? dto.toWarehouseId : null,
            },
          });
          remainingId = created.id;
        }
      }

      await tx.transfer.create({
        data: {
          equipmentId: remainingId,
          equipmentName: item.name,
          factoryNumber: item.factoryNumber,
          quantity: qty,
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

      return remainingId;
    });

    this.excel.scheduleSync();
    return this.prisma.equipment.findUnique({
      where: { id: result },
      include: includeOwner,
    });
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

  private async ownerLabel(
    type: OwnerType,
    userId?: string | null,
    warehouseId?: string | null,
  ) {
    if (type === 'USER') {
      const u = userId
        ? await this.prisma.user.findUnique({ where: { id: userId } })
        : null;
      return u?.fullName || 'Сотрудник';
    }
    const w = warehouseId
      ? await this.prisma.warehouse.findUnique({ where: { id: warehouseId } })
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

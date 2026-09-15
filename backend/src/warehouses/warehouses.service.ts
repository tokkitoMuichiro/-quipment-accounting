import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth-user';
import { hasPermission } from '../common/permissions';
import { CreateWarehouseDto, UpdateWarehouseDto } from './warehouses.dto';
import { REPAIR_WAREHOUSE_NAME, REPAIR_WAREHOUSE_SLUG } from './repair-warehouse';
import { parseAssetCategory } from '../equipment/asset-helpers';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async list(_user: AuthUser) {
    await this.ensureRepairWarehouse();
    return this.prisma.warehouse.findMany({
      include: {
        keepers: { include: { user: true } },
        _count: { select: { equipment: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async get(id: string, user: AuthUser, categoryRaw?: string) {
    const category = parseAssetCategory(categoryRaw);
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        keepers: { include: { user: true } },
      },
    });
    if (!warehouse) {
      throw new NotFoundException('Производственная база не найдена');
    }

    const equipmentInclude = {
      ownerUser: true,
      ownerWarehouse: true,
      pendingTransfer: {
        include: { actor: { select: { id: true, fullName: true } } },
      },
    } as const;

    const owned = await this.prisma.equipment.findMany({
      where: { ownerType: 'WAREHOUSE', ownerWarehouseId: id, category },
      include: equipmentInclude,
      orderBy: { name: 'asc' },
    });

    const pendingInbound = await this.prisma.equipment.findMany({
      where: {
        category,
        pendingTransfer: {
          is: { status: 'PENDING', toWarehouseId: id },
        },
      },
      include: equipmentInclude,
      orderBy: { name: 'asc' },
    });

    const byId = new Map<string, (typeof owned)[number]>();
    for (const item of owned) byId.set(item.id, item);
    for (const item of pendingInbound) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
    let equipment = [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'ru'),
    );

    if (warehouse.slug === REPAIR_WAREHOUSE_SLUG && equipment.length) {
      const equipmentIds = equipment.map((item) => item.id);
      const inbound = await this.prisma.transfer.findMany({
        where: {
          status: 'COMPLETED',
          toWarehouseId: warehouse.id,
          equipmentId: { in: equipmentIds },
        },
        include: {
          actor: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const latestByEquipment = new Map<string, (typeof inbound)[number]>();
      for (const row of inbound) {
        if (!row.equipmentId || latestByEquipment.has(row.equipmentId)) continue;
        latestByEquipment.set(row.equipmentId, row);
      }

      equipment = equipment.map((item) => {
        const last = latestByEquipment.get(item.id);
        return {
          ...item,
          sentToRepairBy: last?.actor
            ? { id: last.actor.id, fullName: last.actor.fullName }
            : null,
          sentToRepairFrom: last?.fromLabel || null,
          sentToRepairAt: last?.createdAt || null,
        };
      }) as typeof equipment;
    }

    const canSeeComment = (item: { ownerUserId?: string | null }) =>
      hasPermission(
        Array.isArray(user.role.permissions)
          ? (user.role.permissions as string[])
          : [],
        'manage_roles',
      ) || item.ownerUserId === user.id;

    return {
      ...warehouse,
      equipment: this.sortByFillPriority(equipment).map((item) =>
        canSeeComment(item) ? item : { ...item, fillComment: null },
      ),
    };
  }

  private sortByFillPriority<
    T extends {
      fillStatus?: string | null;
      name: string;
      factoryNumber?: string | null;
    },
  >(items: T[]): T[] {
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

  create(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({
      data: {
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        keepers: dto.keeperIds?.length
          ? {
              create: dto.keeperIds.map((userId) => ({ userId })),
            }
          : undefined,
      },
      include: { keepers: { include: { user: true } } },
    });
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      throw new NotFoundException('Производственная база не найдена');
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: {
        name: warehouse.isSystem ? warehouse.name : dto.name?.trim(),
        address: dto.address === undefined ? undefined : dto.address.trim() || null,
        keepers:
          dto.keeperIds === undefined
            ? undefined
            : {
                deleteMany: {},
                create: dto.keeperIds.map((userId) => ({ userId })),
              },
      },
      include: { keepers: { include: { user: true } } },
    });
  }

  async remove(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      throw new NotFoundException('Производственная база не найдена');
    }
    if (warehouse.isSystem) {
      throw new ForbiddenException('Системную базу нельзя удалить');
    }
    const count = await this.prisma.equipment.count({
      where: { ownerWarehouseId: id },
    });
    if (count > 0) {
      throw new ForbiddenException(
        'Нельзя удалить производственную базу, пока на ней есть оборудование',
      );
    }
    await this.prisma.warehouse.delete({ where: { id } });
    return { ok: true };
  }
}

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth-user';
import { CreateWarehouseDto, UpdateWarehouseDto } from './warehouses.dto';
import { REPAIR_WAREHOUSE_NAME, REPAIR_WAREHOUSE_SLUG } from './repair-warehouse';

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

  async get(id: string, _user: AuthUser) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        keepers: { include: { user: true } },
        equipment: {
          include: { ownerUser: true, ownerWarehouse: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!warehouse) {
      throw new NotFoundException('Производственная база не найдена');
    }
    return warehouse;
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

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_PERMISSIONS, Permission } from '../common/permissions';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
  }

  private sanitize(permissions?: string[]) {
    if (!permissions) {
      return undefined;
    }
    return permissions.filter((p) =>
      (ALL_PERMISSIONS as readonly string[]).includes(p),
    ) as Permission[];
  }

  async create(dto: { name: string; permissions: string[] }) {
    const slug = dto.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9а-яё-]/gi, '');

    return this.prisma.role.create({
      data: {
        name: dto.name.trim(),
        slug: `${slug}-${Date.now().toString(36)}`,
        permissions: this.sanitize(dto.permissions) || [],
      },
    });
  }

  async update(
    id: string,
    dto: { name?: string; permissions?: string[] },
  ) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Роль не найдена');
    }

    const permissions = this.sanitize(dto.permissions);
    if (
      role.slug === 'admin' &&
      permissions &&
      !permissions.includes('manage_roles')
    ) {
      throw new BadRequestException(
        'Нельзя убрать право настройки ролей у администратора',
      );
    }
    if (
      role.slug === 'admin' &&
      permissions &&
      !permissions.includes('edit_all')
    ) {
      throw new BadRequestException(
        'Нельзя убрать право полного редактирования у администратора',
      );
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        permissions,
      },
    });
  }
}

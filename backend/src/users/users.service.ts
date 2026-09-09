import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, isAdmin } from '../common/auth-user';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(viewer: AuthUser) {
    if (isAdmin(viewer)) {
      return this.prisma.user.findMany({
        orderBy: { fullName: 'asc' },
        include: {
          role: true,
          keepers: { include: { warehouse: true } },
          _count: { select: { equipment: true } },
        },
      });
    }

    return this.prisma.user.findMany({
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        role: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async assignRole(userId: string, roleId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.role.findUnique({ where: { id: roleId } }),
    ]);
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    if (!role) {
      throw new NotFoundException('Роль не найдена');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true, keepers: true },
    });
  }
}

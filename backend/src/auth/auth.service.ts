import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth-user';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signToken(userId: string) {
    return this.jwt.sign({ sub: userId });
  }

  async loadUser(userId: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, keepers: true },
    });
  }

  async upsertFromBitrix(params: {
    bitrixUserId: string;
    fullName: string;
    email?: string | null;
  }): Promise<AuthUser> {
    const existing = await this.prisma.user.findUnique({
      where: { bitrixUserId: params.bitrixUserId },
      include: { role: true, keepers: true },
    });

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: params.fullName || existing.fullName,
          email: params.email ?? existing.email,
        },
        include: { role: true, keepers: true },
      });
    }

    const userCount = await this.prisma.user.count();
    const adminIds = (this.config.get<string>('ADMIN_BITRIX_IDS') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const makeAdmin =
      userCount === 0 || adminIds.includes(params.bitrixUserId);

    const role = await this.prisma.role.findUnique({
      where: { slug: makeAdmin ? 'admin' : 'master' },
    });

    if (!role) {
      throw new Error('Роли не инициализированы. Выполните prisma db seed.');
    }

    return this.prisma.user.create({
      data: {
        bitrixUserId: params.bitrixUserId,
        fullName: params.fullName,
        email: params.email ?? null,
        roleId: role.id,
      },
      include: { role: true, keepers: true },
    });
  }

  serialize(user: AuthUser) {
    return {
      id: user.id,
      bitrixUserId: user.bitrixUserId,
      fullName: user.fullName,
      email: user.email,
      role: {
        id: user.role.id,
        name: user.role.name,
        slug: user.role.slug,
        permissions: user.role.permissions,
      },
      warehouseIds: user.keepers.map((k) => k.warehouseId),
    };
  }
}

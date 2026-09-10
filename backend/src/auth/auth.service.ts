import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth-user';

const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

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

  private cookieOptions() {
    const frontend = this.config.get<string>('FRONTEND_URL') || '';
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: frontend.startsWith('https'),
      path: '/',
    };
  }

  setAuthCookie(res: Response, token: string) {
    res.cookie('token', token, {
      ...this.cookieOptions(),
      maxAge: COOKIE_MAX_AGE_MS,
    });
  }

  clearAuthCookie(res: Response) {
    res.clearCookie('token', this.cookieOptions());
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

  /** Локальный вход: фиксированный bitrixUserId и роль. */
  async upsertDevUser(params: {
    bitrixUserId: string;
    fullName: string;
    roleSlug: string;
    email?: string | null;
  }): Promise<AuthUser> {
    const role = await this.prisma.role.findUnique({
      where: { slug: params.roleSlug },
    });
    if (!role) {
      throw new Error(
        `Роль «${params.roleSlug}» не найдена. Выполните prisma db seed.`,
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { bitrixUserId: params.bitrixUserId },
    });

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: params.fullName,
          email: params.email ?? existing.email,
          roleId: role.id,
        },
        include: { role: true, keepers: true },
      });
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
      notifyBitrix: user.notifyBitrix !== false,
      role: {
        id: user.role.id,
        name: user.role.name,
        slug: user.role.slug,
        permissions: user.role.permissions,
      },
      warehouseIds: user.keepers.map((k) => k.warehouseId),
    };
  }

  async updateNotifyBitrix(userId: string, notifyBitrix: boolean) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { notifyBitrix },
      include: { role: true, keepers: true },
    });
    return this.serialize(user);
  }
}

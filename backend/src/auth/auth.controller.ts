import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user';
import { isProductionEnv } from './jwt-secret';

class DevLoginDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @IsOptional()
  @IsString()
  email?: string;

  /** admin | master | keeper — только при DEV_AUTH */
  @IsOptional()
  @IsString()
  roleSlug?: string;

  @IsOptional()
  @IsString()
  bitrixUserId?: string;
}

class NotifySettingsDto {
  @IsBoolean()
  notifyBitrix: boolean;
}

class ExchangeDto {
  @IsString()
  @MinLength(16)
  code: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('dev-status')
  devStatus() {
    const enabled =
      this.config.get('DEV_AUTH') === 'true' && !isProductionEnv(this.config);
    return { enabled };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.serialize(user);
  }

  @Patch('me/settings')
  @UseGuards(JwtAuthGuard)
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: NotifySettingsDto,
  ) {
    return this.auth.updateNotifyBitrix(user.id, dto.notifyBitrix);
  }

  @Post('exchange')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async exchange(
    @Body() dto: ExchangeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = this.auth.consumeExchangeCode(dto.code);
    const user = await this.auth.loadUser(userId);
    if (!user) {
      throw new ForbiddenException('Пользователь не найден');
    }
    const token = this.auth.signToken(user.id);
    this.auth.setAuthCookie(res, token);
    return { user: this.auth.serialize(user) };
  }

  @Post('dev-login')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async devLogin(
    @Body() dto: DevLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (this.config.get('DEV_AUTH') !== 'true' || isProductionEnv(this.config)) {
      throw new ForbiddenException('Локальный вход выключен');
    }

    const fullName = dto.fullName.trim();
    const nameSlug = fullName.toLowerCase().replace(/\s+/g, '-');
    const bitrixUserId = (dto.bitrixUserId || `dev:${nameSlug}`).trim();
    const allowedRoles = new Set(['admin', 'master', 'keeper']);
    const roleSlug =
      dto.roleSlug && allowedRoles.has(dto.roleSlug) ? dto.roleSlug : null;

    const user = roleSlug
      ? await this.auth.upsertDevUser({
          bitrixUserId,
          fullName,
          roleSlug,
          email: dto.email ?? null,
        })
      : await this.auth.upsertFromBitrix({
          bitrixUserId,
          fullName,
          email: dto.email ?? null,
        });

    const token = this.auth.signToken(user.id);
    this.auth.setAuthCookie(res, token);
    return {
      user: this.auth.serialize(user),
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.auth.clearAuthCookie(res);
    return { ok: true };
  }
}

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MinLength } from 'class-validator';
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
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.serialize(user);
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

    const slug = dto.fullName.trim().toLowerCase().replace(/\s+/g, '-');
    const user = await this.auth.upsertFromBitrix({
      bitrixUserId: `dev:${slug}`,
      fullName: dto.fullName.trim(),
      email: dto.email ?? null,
    });

    const token = this.auth.signToken(user.id);
    this.auth.setAuthCookie(res, token);
    return {
      token,
      user: this.auth.serialize(user),
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.auth.clearAuthCookie(res);
    return { ok: true };
  }
}

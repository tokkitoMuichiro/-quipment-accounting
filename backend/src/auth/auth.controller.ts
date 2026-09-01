import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user';

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
  async devLogin(@Body() dto: DevLoginDto) {
    if (this.config.get('DEV_AUTH') !== 'true') {
      throw new ForbiddenException('Локальный вход выключен');
    }

    const slug = dto.fullName.trim().toLowerCase().replace(/\s+/g, '-');
    const user = await this.auth.upsertFromBitrix({
      bitrixUserId: `dev:${slug}`,
      fullName: dto.fullName.trim(),
      email: dto.email ?? null,
    });

    return {
      token: this.auth.signToken(user.id),
      user: this.auth.serialize(user),
    };
  }
}

import {
  All,
  BadRequestException,
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { BitrixService } from './bitrix.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('bitrix')
export class BitrixController {
  constructor(
    private readonly bitrix: BitrixService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @All('install')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async install(@Req() req: Request, @Res() res: Response) {
    const payload = this.bitrix.parseIncoming(req.body || {}, req.query as any);
    await this.bitrix.savePortal(payload);
    if (payload.domain && payload.accessToken) {
      await this.bitrix.bindLeftMenu(payload.domain, payload.accessToken);
    }

    const handler = this.bitrix.openHandlerUrl();
    res
      .status(200)
      .type('html')
      .setHeader('Content-Security-Policy', "frame-ancestors https://*.bitrix24.ru https://*.bitrix24.com https://*.bitrix24.by https://*.bitrix24.kz https://*.bitrix24.ua")
      .send(
        `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Установка</title>
        <script src="https://api.bitrix24.com/api/v1/"></script></head>
        <body style="font-family:sans-serif;padding:24px">
        <h2>Учёт оборудования установлен</h2>
        <p>Пункт появится в левом меню, в группе «Приложения» (она свёрнута). Можно закрыть окно.</p>
        <script>
        (function () {
          var handler = ${JSON.stringify(handler)};
          function finish() {
            if (window.BX24 && BX24.installFinish) BX24.installFinish();
          }
          if (!window.BX24) { finish(); return; }
          BX24.init(function () {
            BX24.callMethod('placement.bind', {
              PLACEMENT: 'LEFT_MENU',
              HANDLER: handler,
              TITLE: 'Учёт оборудования'
            }, function () { finish(); });
          });
        })();
        </script>
        </body></html>`,
      );
  }

  @All('open')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async open(@Req() req: Request, @Res() res: Response) {
    const payload = this.bitrix.parseIncoming(req.body || {}, req.query as any);
    if (!payload.accessToken || !payload.domain) {
      throw new BadRequestException('Нет данных авторизации Битрикс24');
    }

    await this.bitrix.savePortal(payload);

    const bxUser = await this.bitrix.currentUser(
      payload.domain,
      payload.accessToken,
    );

    const fullName =
      [bxUser.LAST_NAME, bxUser.NAME, bxUser.SECOND_NAME]
        .filter(Boolean)
        .join(' ')
        .trim() || `Сотрудник ${bxUser.ID}`;

    const user = await this.auth.upsertFromBitrix({
      bitrixUserId: String(bxUser.ID),
      fullName,
      email: bxUser.EMAIL || null,
    });

    const token = this.auth.signToken(user.id);
    this.auth.setAuthCookie(res, token);
    const frontend = this.config.get<string>('FRONTEND_URL') || '/';
    const url = `${frontend.replace(/\/$/, '')}/#token=${encodeURIComponent(token)}`;
    res.redirect(302, url);
  }

  @Get('employees')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('manage_roles')
  async employees() {
    const portal = await this.prisma.bitrixPortal.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!portal) {
      const locals = await this.prisma.user.findMany({
        orderBy: { fullName: 'asc' },
      });
      return locals.map((u) => ({
        id: u.id,
        bitrixUserId: u.bitrixUserId,
        fullName: u.fullName,
        email: u.email,
      }));
    }

    const employees = await this.bitrix.listEmployees(
      portal.domain,
      portal.accessToken,
    );

    const result: Array<{
      id: string;
      bitrixUserId: string;
      fullName: string;
      email: string | null;
    }> = [];
    for (const emp of employees) {
      const local = await this.auth.upsertFromBitrix(emp);
      result.push({
        id: local.id,
        bitrixUserId: local.bitrixUserId,
        fullName: local.fullName,
        email: local.email,
      });
    }
    return result;
  }
}

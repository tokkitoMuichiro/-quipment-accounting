import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { deriveSecretKey, openSecret, sealSecret } from '../common/secret-box';
import { isProductionEnv } from '../auth/jwt-secret';

type BitrixAuthPayload = {
  accessToken?: string;
  refreshToken?: string;
  domain?: string;
  memberId?: string;
  clientEndpoint?: string;
  applicationToken?: string;
};

const BITRIX_DOMAIN_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+bitrix24\.(ru|com|by|kz|ua|eu|[a-z]{2})$/i;

@Injectable()
export class BitrixService {
  private readonly logger = new Logger(BitrixService.name);
  private readonly cryptoKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const raw =
      this.config.get<string>('BITRIX_TOKEN_KEY') ||
      this.config.get<string>('JWT_SECRET') ||
      'dev-only-insecure-key';
    this.cryptoKey = deriveSecretKey(raw);
  }

  parseIncoming(
    body: Record<string, any>,
    query: Record<string, any>,
  ): BitrixAuthPayload {
    const src = { ...query, ...body };
    const auth = src.auth && typeof src.auth === 'object' ? src.auth : {};

    const accessToken =
      auth.access_token ||
      src.AUTH_ID ||
      src.auth_id ||
      src.access_token;

    const refreshToken =
      auth.refresh_token ||
      src.REFRESH_ID ||
      src.refresh_id ||
      src.refresh_token;

    const domain = (
      auth.domain ||
      src.DOMAIN ||
      src.domain ||
      ''
    )
      .toString()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();

    const memberId = auth.member_id || src.member_id || src.memberId || domain;
    const clientEndpoint = auth.client_endpoint || src.client_endpoint;
    const applicationToken =
      auth.application_token ||
      src.application_token ||
      src.APP_SID ||
      src.app_sid ||
      undefined;

    return {
      accessToken,
      refreshToken,
      domain,
      memberId,
      clientEndpoint,
      applicationToken,
    };
  }

  assertSafePayload(payload: BitrixAuthPayload) {
    if (!payload.domain) {
      throw new BadRequestException('Не указан домен Битрикс24');
    }
    this.assertAllowedDomain(payload.domain);
    this.assertApplicationToken(payload.applicationToken);
  }

  assertAllowedDomain(domain: string) {
    const host = domain
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
    if (!BITRIX_DOMAIN_RE.test(host) || host.includes('..')) {
      throw new BadRequestException('Недопустимый домен Битрикс24');
    }
  }

  private assertApplicationToken(incoming?: string) {
    const expected = (
      this.config.get<string>('BITRIX_APPLICATION_TOKEN') || ''
    ).trim();
    if (!expected) {
      if (isProductionEnv(this.config)) {
        throw new UnauthorizedException(
          'BITRIX_APPLICATION_TOKEN не задан на сервере',
        );
      }
      this.logger.warn(
        'BITRIX_APPLICATION_TOKEN пуст — проверка application_token пропущена (только dev)',
      );
      return;
    }
    if (!incoming || incoming !== expected) {
      throw new UnauthorizedException('Неверный application_token Битрикс24');
    }
  }

  private seal(value: string) {
    return sealSecret(value, this.cryptoKey);
  }

  private open(value: string) {
    return openSecret(value, this.cryptoKey);
  }

  decryptPortal<T extends { accessToken: string; refreshToken: string }>(
    portal: T,
  ): T {
    return {
      ...portal,
      accessToken: this.open(portal.accessToken),
      refreshToken: this.open(portal.refreshToken),
    };
  }

  async getLatestPortal() {
    const portal = await this.prisma.bitrixPortal.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    return portal ? this.decryptPortal(portal) : null;
  }

  async savePortal(payload: BitrixAuthPayload) {
    if (!payload.memberId || !payload.domain || !payload.accessToken) {
      return null;
    }
    this.assertAllowedDomain(payload.domain);

    return this.prisma.bitrixPortal.upsert({
      where: { memberId: payload.memberId },
      create: {
        memberId: payload.memberId,
        domain: payload.domain,
        accessToken: this.seal(payload.accessToken),
        refreshToken: this.seal(payload.refreshToken || ''),
        clientEndpoint: payload.clientEndpoint,
      },
      update: {
        domain: payload.domain,
        accessToken: this.seal(payload.accessToken),
        refreshToken: payload.refreshToken
          ? this.seal(payload.refreshToken)
          : undefined,
        clientEndpoint: payload.clientEndpoint,
      },
    });
  }

  openHandlerUrl() {
    const frontend = (this.config.get<string>('FRONTEND_URL') || '').replace(
      /\/$/,
      '',
    );
    return `${frontend}/api/bitrix/open`;
  }

  async bindLeftMenu(domain: string, accessToken: string) {
    const handler = this.openHandlerUrl();
    if (!domain || !accessToken || !handler.startsWith('https://')) {
      return;
    }
    this.assertAllowedDomain(domain);
    try {
      await this.call(
        domain,
        'placement.bind',
        {
          PLACEMENT: 'LEFT_MENU',
          HANDLER: handler,
          TITLE: 'Учёт оборудования',
        },
        accessToken,
      );
    } catch (error: any) {
      const message = error?.bitrix?.error || error?.message || '';
      if (
        String(message).includes('ERROR_PLACEMENT_ALREADY_BIND') ||
        String(message).toLowerCase().includes('already')
      ) {
        return;
      }
      this.logger.warn(`placement.bind: ${message}`);
    }
  }

  async call(
    domain: string,
    method: string,
    params: Record<string, unknown>,
    accessToken: string,
  ) {
    this.assertAllowedDomain(domain);
    const url = `https://${domain}/rest/${method}.json`;
    const { data } = await axios.post(
      url,
      { ...params, auth: accessToken },
      { timeout: 20000 },
    );

    if (data?.error) {
      const err = new Error(data.error_description || data.error);
      (err as any).bitrix = data;
      throw err;
    }

    return data;
  }

  async refreshPortal(portal: {
    id: string;
    domain: string;
    refreshToken: string;
  }) {
    const clientId = this.config.get<string>('BITRIX_CLIENT_ID');
    const clientSecret = this.config.get<string>('BITRIX_CLIENT_SECRET');
    const refreshToken = this.open(portal.refreshToken);
    if (!clientId || !clientSecret || !refreshToken) {
      return null;
    }

    this.assertAllowedDomain(portal.domain);

    const { data } = await axios.get('https://oauth.bitrix.info/oauth/token/', {
      params: {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      },
      timeout: 15000,
    });

    if (!data?.access_token) {
      this.logger.warn('Не удалось обновить токен Битрикс');
      return null;
    }

    const updated = await this.prisma.bitrixPortal.update({
      where: { id: portal.id },
      data: {
        accessToken: this.seal(data.access_token),
        refreshToken: this.seal(data.refresh_token || refreshToken),
        domain: data.domain || portal.domain,
      },
    });
    return this.decryptPortal(updated);
  }

  async callWithPortal(
    portal: {
      id: string;
      domain: string;
      accessToken: string;
      refreshToken: string;
    },
    method: string,
    params: Record<string, unknown> = {},
  ) {
    const opened = this.decryptPortal(portal);
    try {
      return await this.call(opened.domain, method, params, opened.accessToken);
    } catch (error: any) {
      const code = error?.bitrix?.error;
      if (code === 'expired_token' || code === 'INVALID_TOKEN') {
        const refreshed = await this.refreshPortal(portal);
        if (refreshed) {
          return this.call(
            refreshed.domain,
            method,
            params,
            refreshed.accessToken,
          );
        }
      }
      throw error;
    }
  }

  async currentUser(domain: string, accessToken: string) {
    const data = await this.call(domain, 'user.current', {}, accessToken);
    return data.result;
  }

  async listEmployees(domain: string, accessToken: string) {
    const result: any[] = [];
    let start = 0;

    while (true) {
      const data = await this.call(
        domain,
        'user.get',
        {
          FILTER: { ACTIVE: true },
          start,
        },
        accessToken,
      );
      const batch = data.result || [];
      result.push(...batch);
      if (!data.next) {
        break;
      }
      start = data.next;
      if (result.length > 2000) {
        break;
      }
    }

    return result.map((u) => ({
      bitrixUserId: String(u.ID),
      fullName:
        [u.LAST_NAME, u.NAME, u.SECOND_NAME].filter(Boolean).join(' ').trim() ||
        u.EMAIL ||
        `Сотрудник ${u.ID}`,
      email: u.EMAIL || null,
    }));
  }
}

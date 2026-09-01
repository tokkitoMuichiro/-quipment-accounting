import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

type BitrixAuthPayload = {
  accessToken?: string;
  refreshToken?: string;
  domain?: string;
  memberId?: string;
  clientEndpoint?: string;
};

@Injectable()
export class BitrixService {
  private readonly logger = new Logger(BitrixService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  parseIncoming(body: Record<string, any>, query: Record<string, any>): BitrixAuthPayload {
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
      .replace(/\/$/, '');

    const memberId = auth.member_id || src.member_id || src.memberId || domain;
    const clientEndpoint = auth.client_endpoint || src.client_endpoint;

    return {
      accessToken,
      refreshToken,
      domain,
      memberId,
      clientEndpoint,
    };
  }

  async savePortal(payload: BitrixAuthPayload) {
    if (!payload.memberId || !payload.domain || !payload.accessToken) {
      return null;
    }

    return this.prisma.bitrixPortal.upsert({
      where: { memberId: payload.memberId },
      create: {
        memberId: payload.memberId,
        domain: payload.domain,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken || '',
        clientEndpoint: payload.clientEndpoint,
      },
      update: {
        domain: payload.domain,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken || undefined,
        clientEndpoint: payload.clientEndpoint,
      },
    });
  }

  async call(
    domain: string,
    method: string,
    params: Record<string, unknown>,
    accessToken: string,
  ) {
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
    if (!clientId || !clientSecret || !portal.refreshToken) {
      return null;
    }

    const { data } = await axios.get('https://oauth.bitrix.info/oauth/token/', {
      params: {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: portal.refreshToken,
      },
      timeout: 15000,
    });

    if (!data?.access_token) {
      this.logger.warn('Не удалось обновить токен Битрикс');
      return null;
    }

    return this.prisma.bitrixPortal.update({
      where: { id: portal.id },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || portal.refreshToken,
        domain: data.domain || portal.domain,
      },
    });
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
    try {
      return await this.call(portal.domain, method, params, portal.accessToken);
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
      fullName: [u.LAST_NAME, u.NAME, u.SECOND_NAME].filter(Boolean).join(' ').trim() ||
        u.EMAIL ||
        `Сотрудник ${u.ID}`,
      email: u.EMAIL || null,
    }));
  }
}

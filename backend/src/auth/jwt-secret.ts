import { ConfigService } from '@nestjs/config';

const WEAK_SECRETS = [
  'dev-secret',
  'change-me',
  'change-me-to-a-long-random-string',
];

export function resolveJwtSecret(config: ConfigService): string {
  const secret = (config.get<string>('JWT_SECRET') || '').trim();
  const nodeEnv =
    config.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development';

  if (!secret) {
    throw new Error(
      'Задайте JWT_SECRET в .env — без него сервер не запустится.',
    );
  }
  if (secret.length < 16) {
    throw new Error('JWT_SECRET должен быть не короче 16 символов.');
  }
  if (nodeEnv === 'production' && WEAK_SECRETS.includes(secret)) {
    throw new Error(
      'В продакшене нужен уникальный JWT_SECRET, не значение из примера.',
    );
  }
  return secret;
}

export function isProductionEnv(config?: ConfigService): boolean {
  const nodeEnv =
    config?.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development';
  return nodeEnv === 'production';
}

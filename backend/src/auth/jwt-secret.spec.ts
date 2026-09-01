import { ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from './jwt-secret';

function config(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

describe('resolveJwtSecret', () => {
  it('rejects an empty secret', () => {
    expect(() => resolveJwtSecret(config({ JWT_SECRET: '' }))).toThrow(
      /JWT_SECRET/,
    );
  });

  it('rejects a short secret', () => {
    expect(() => resolveJwtSecret(config({ JWT_SECRET: 'too-short' }))).toThrow(
      /16/,
    );
  });

  it('rejects the example secret in production', () => {
    expect(() =>
      resolveJwtSecret(
        config({
          JWT_SECRET: 'change-me-to-a-long-random-string',
          NODE_ENV: 'production',
        }),
      ),
    ).toThrow(/уникальный/);
  });

  it('accepts a unique secret locally', () => {
    expect(
      resolveJwtSecret(
        config({
          JWT_SECRET: 'change-me-to-a-long-random-string',
          NODE_ENV: 'development',
        }),
      ),
    ).toBe('change-me-to-a-long-random-string');
  });
});

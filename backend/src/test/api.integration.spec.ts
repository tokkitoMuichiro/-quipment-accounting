import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { NotifyService } from '../bitrix/notify.service';
import { ExcelService } from '../excel/excel.service';

const backendRoot = join(__dirname, '..', '..');

function testDatabaseUrl() {
  return (
    process.env.TEST_DATABASE_URL ||
    'postgresql://equipment:equipment@localhost:5432/equipment'
  );
}

function applyTestEnv() {
  process.env.DATABASE_URL = testDatabaseUrl();
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'test-jwt-secret-min-16-chars';
  process.env.DEV_AUTH = 'true';
  process.env.NODE_ENV = 'test';
  return { ...process.env };
}

async function createApp(): Promise<INestApplication> {
  const { AppModule } = await import('../app.module');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(NotifyService)
    .useValue({
      scheduleIncomingTransfer: jest.fn(),
      scheduleFillNotice: jest.fn(),
    })
    .overrideProvider(ExcelService)
    .useValue({
      scheduleSync: jest.fn(),
      onModuleDestroy: jest.fn(),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

async function devLogin(
  app: INestApplication,
  suffix: string,
  roleSlug = 'master',
) {
  const res = await request(app.getHttpServer())
    .post('/api/auth/dev-login')
    .send({
      fullName: `Test ${suffix}`,
      roleSlug,
      bitrixUserId: `dev:api-test-${suffix}`,
    })
    .expect(201);

  return {
    token: res.body.token as string,
    user: res.body.user as { id: string; fullName: string },
  };
}

describe('API integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const env = applyTestEnv();
    execSync('npx prisma migrate deploy', {
      cwd: backendRoot,
      env,
      stdio: 'inherit',
    });
    execSync('npx prisma db seed', {
      cwd: backendRoot,
      env,
      stdio: 'inherit',
    });
    app = await createApp();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ ok: true, service: 'equipment-api' });
  });

  it('dev-login and GET /api/auth/me', async () => {
    const { token, user } = await devLogin(app, 'me-user');

    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.id).toBe(user.id);
    expect(res.body.fullName).toBe(user.fullName);
    expect(res.body.role.slug).toBe('master');
  });

  it('creates equipment and forbids editing someone else item', async () => {
    const owner = await devLogin(app, 'owner-a');
    const stranger = await devLogin(app, 'stranger-b');

    const created = await request(app.getHttpServer())
      .post('/api/equipment')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Дрель API-test',
        type: 'SERIAL',
        factoryNumber: `SN-${Date.now()}`,
        condition: 'OK',
        ownerType: 'USER',
        ownerUserId: owner.user.id,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/equipment/${created.body.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ name: 'Чужая правка' })
      .expect(403);
  });

  it('transfer to user, accept, and cancel pending paths', async () => {
    const sender = await devLogin(app, 'sender-transfer');
    const recipient = await devLogin(app, 'recipient-transfer');

    const item = await request(app.getHttpServer())
      .post('/api/equipment')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        name: 'Перфоратор API-test',
        type: 'SERIAL',
        factoryNumber: `TR-${Date.now()}`,
        condition: 'OK',
        ownerType: 'USER',
        ownerUserId: sender.user.id,
      })
      .expect(201);

    const pending = await request(app.getHttpServer())
      .post(`/api/equipment/${item.body.id}/transfer`)
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        toOwnerType: 'USER',
        toUserId: recipient.user.id,
      })
      .expect(201);

    expect(pending.body.pendingTransfer?.status).toBe('PENDING');

    const cancelled = await request(app.getHttpServer())
      .post(`/api/equipment/${item.body.id}/cancel-pending`)
      .set('Authorization', `Bearer ${sender.token}`)
      .expect(201);

    expect(cancelled.body.pendingTransfer).toBeNull();

    await request(app.getHttpServer())
      .post(`/api/equipment/${item.body.id}/transfer`)
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        toOwnerType: 'USER',
        toUserId: recipient.user.id,
      })
      .expect(201);

    const accepted = await request(app.getHttpServer())
      .post(`/api/equipment/${item.body.id}/accept`)
      .set('Authorization', `Bearer ${recipient.token}`)
      .expect(201);

    expect(accepted.body.ownerUserId).toBe(recipient.user.id);
    expect(accepted.body.pendingTransfer).toBeNull();
  });
});

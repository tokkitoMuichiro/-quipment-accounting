import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  'view_own',
  'view_all',
  'create',
  'edit',
  'edit_all',
  'edit_condition',
  'delete',
  'transfer',
  'manage_warehouses',
  'manage_roles',
  'export_excel',
];

async function ensurePermissions(slug: string, required: string[]) {
  const role = await prisma.role.findUnique({ where: { slug } });
  if (!role) return;
  const current = Array.isArray(role.permissions)
    ? (role.permissions as string[])
    : [];
  const missing = required.filter((p) => !current.includes(p));
  if (!missing.length) return;
  await prisma.role.update({
    where: { id: role.id },
    data: { permissions: [...current, ...missing] },
  });
}

async function main() {
  await prisma.role.upsert({
    where: { slug: 'admin' },
    update: { name: 'Администратор', isSystem: true },
    create: {
      name: 'Администратор',
      slug: 'admin',
      isSystem: true,
      permissions: ALL_PERMISSIONS,
    },
  });

  await prisma.role.upsert({
    where: { slug: 'master' },
    update: { name: 'Мастер', isSystem: true },
    create: {
      name: 'Мастер',
      slug: 'master',
      isSystem: true,
      permissions: ['view_own', 'create', 'edit', 'transfer', 'edit_condition'],
    },
  });

  await prisma.role.upsert({
    where: { slug: 'keeper' },
    update: { name: 'Кладовщик', isSystem: true },
    create: {
      name: 'Кладовщик',
      slug: 'keeper',
      isSystem: true,
      permissions: [
        'view_own',
        'view_all',
        'create',
        'edit',
        'edit_condition',
        'transfer',
        'manage_warehouses',
      ],
    },
  });

  // Добавляем новые права, не затирая кастомные настройки.
  await ensurePermissions('admin', ALL_PERMISSIONS);
  await ensurePermissions('master', ['edit']);
  await ensurePermissions('keeper', ['edit']);

  const repair = await prisma.warehouse.upsert({
    where: { slug: 'repair' },
    update: { name: 'Ремонт', isSystem: true },
    create: {
      name: 'Ремонт',
      slug: 'repair',
      isSystem: true,
    },
  });

  // Моки только явно и никогда в production (compose на сервере тоже гоняет seed).
  const wantDemo =
    process.env.SEED_DEMO_USERS === 'true' &&
    process.env.NODE_ENV !== 'production';

  if (!wantDemo) {
    if (process.env.SEED_DEMO_USERS === 'true') {
      console.log('SEED_DEMO_USERS игнорируется: NODE_ENV=production');
    }
    return;
  }

  const roles = Object.fromEntries(
    (
      await prisma.role.findMany({
        where: { slug: { in: ['admin', 'master', 'keeper'] } },
      })
    ).map((r) => [r.slug, r]),
  );

  const demoUsers = [
    {
      bitrixUserId: 'dev:admin-testov',
      fullName: 'Админ Тестов',
      roleSlug: 'admin',
    },
    {
      bitrixUserId: 'dev:master-ivanov',
      fullName: 'Мастер Иванов',
      roleSlug: 'master',
    },
    {
      bitrixUserId: 'dev:master-sidorov',
      fullName: 'Мастер Сидоров',
      roleSlug: 'master',
    },
    {
      bitrixUserId: 'dev:keeper-sklad',
      fullName: 'Кладовщик Складской',
      roleSlug: 'keeper',
    },
  ] as const;

  const created: Record<string, string> = {};
  for (const demo of demoUsers) {
    const role = roles[demo.roleSlug];
    if (!role) continue;
    const user = await prisma.user.upsert({
      where: { bitrixUserId: demo.bitrixUserId },
      update: {
        fullName: demo.fullName,
        roleId: role.id,
      },
      create: {
        bitrixUserId: demo.bitrixUserId,
        fullName: demo.fullName,
        roleId: role.id,
        notifyBitrix: false,
      },
    });
    created[demo.bitrixUserId] = user.id;
  }

  const north = await prisma.warehouse.upsert({
    where: { slug: 'demo-north' },
    update: { name: 'База Север' },
    create: {
      name: 'База Север',
      slug: 'demo-north',
      address: 'Тестовая база для локальной разработки',
      isSystem: false,
    },
  });

  const keeperId = created['dev:keeper-sklad'];
  if (keeperId) {
    for (const warehouseId of [north.id, repair.id]) {
      await prisma.warehouseKeeper.upsert({
        where: {
          userId_warehouseId: { userId: keeperId, warehouseId },
        },
        update: {},
        create: { userId: keeperId, warehouseId },
      });
    }
  }

  console.log(
    'DEV: демо-пользователи — Админ Тестов, Мастер Иванов, Мастер Сидоров, Кладовщик Складской (+ База Север).',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

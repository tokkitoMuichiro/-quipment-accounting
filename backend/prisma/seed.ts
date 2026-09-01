import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  'view_own',
  'view_all',
  'create',
  'edit',
  'edit_condition',
  'delete',
  'transfer',
  'manage_warehouses',
  'manage_roles',
  'export_excel',
];

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
      permissions: ['view_own', 'create', 'transfer', 'edit_condition'],
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
        'edit_condition',
        'transfer',
        'manage_warehouses',
      ],
    },
  });

  await prisma.warehouse.upsert({
    where: { slug: 'repair' },
    update: { name: 'Ремонт', isSystem: true },
    create: {
      name: 'Ремонт',
      slug: 'repair',
      isSystem: true,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

import {
  canActOnItem,
  canDeleteItem,
  canEditDocuments,
  canTransferFrom,
  isAdmin,
  isPrivilegedStaff,
} from './auth-user';
import { AuthUser } from './auth-user';

function user(overrides: Partial<AuthUser> & { perms: string[]; keeperIds?: string[] }): AuthUser {
  return {
    id: 'u1',
    bitrixUserId: '1',
    fullName: 'Иван',
    email: null,
    roleId: 'r1',
    createdAt: new Date(),
    updatedAt: new Date(),
    role: {
      id: 'r1',
      name: 'role',
      slug: 'role',
      isSystem: false,
      permissions: overrides.perms,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    keepers: (overrides.keeperIds || []).map((warehouseId) => ({
      userId: overrides.id || 'u1',
      warehouseId,
    })),
    ...overrides,
  } as AuthUser;
}

const ownItem = {
  ownerType: 'USER',
  ownerUserId: 'u1',
  ownerWarehouseId: null,
};

const foreignItem = {
  ownerType: 'USER',
  ownerUserId: 'u2',
  ownerWarehouseId: null,
};

const warehouseItem = {
  ownerType: 'WAREHOUSE',
  ownerUserId: null,
  ownerWarehouseId: 'wh-1',
};

const repairItem = {
  ownerType: 'WAREHOUSE',
  ownerUserId: null,
  ownerWarehouseId: 'repair',
};

describe('auth-user access', () => {
  const admin = user({
    perms: ['manage_roles', 'edit', 'delete', 'transfer', 'edit_condition'],
  });
  const master = user({
    perms: ['view_own', 'create', 'transfer', 'edit_condition'],
  });
  const keeper = user({
    id: 'keeper-1',
    perms: ['view_own', 'create', 'transfer', 'edit_condition', 'manage_warehouses'],
    keeperIds: ['wh-1', 'repair'],
  });
  const otherKeeper = user({
    id: 'u3',
    perms: ['view_own', 'transfer', 'edit_condition'],
    keeperIds: ['other-wh'],
  });

  it('treats manage_roles as admin', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(master)).toBe(false);
    expect(isPrivilegedStaff(admin)).toBe(true);
  });

  it('lets a master act only on own equipment', () => {
    expect(canActOnItem(master, ownItem)).toBe(true);
    expect(canActOnItem(master, foreignItem)).toBe(false);
    expect(canActOnItem(master, warehouseItem)).toBe(false);
    expect(canTransferFrom(master, ownItem)).toBe(true);
    expect(canTransferFrom(master, warehouseItem)).toBe(false);
    expect(canEditDocuments(master, ownItem)).toBe(true);
    expect(canEditDocuments(master, foreignItem)).toBe(false);
  });

  it('lets a warehouse keeper act on assigned stock including repair', () => {
    expect(canActOnItem(keeper, warehouseItem)).toBe(true);
    expect(canTransferFrom(keeper, repairItem)).toBe(true);
    expect(canEditDocuments(keeper, warehouseItem)).toBe(true);
    expect(canEditDocuments(keeper, ownItem)).toBe(false);
    expect(canTransferFrom(otherKeeper, repairItem)).toBe(false);
  });

  it('lets admin edit documents and delete anywhere', () => {
    expect(canEditDocuments(admin, foreignItem)).toBe(true);
    expect(canEditDocuments(admin, repairItem)).toBe(true);
    expect(canDeleteItem(admin, foreignItem)).toBe(true);
    expect(canDeleteItem(master, ownItem)).toBe(false);
  });

  it('does not let a master take equipment off the repair warehouse', () => {
    expect(canTransferFrom(master, repairItem)).toBe(false);
    expect(canTransferFrom(admin, repairItem)).toBe(true);
    expect(canTransferFrom(keeper, repairItem)).toBe(true);
  });
});

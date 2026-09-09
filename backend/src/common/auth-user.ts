import { User, Role, WarehouseKeeper } from '@prisma/client';
import { hasPermission } from './permissions';

export type AuthUser = User & {
  role: Role;
  keepers: WarehouseKeeper[];
};

export function rolePermissions(user: AuthUser): string[] {
  return Array.isArray(user.role.permissions)
    ? (user.role.permissions as string[])
    : [];
}

export function isWarehouseKeeper(user: AuthUser, warehouseId: string): boolean {
  return user.keepers.some((k) => k.warehouseId === warehouseId);
}

export function keeperWarehouseIds(user: AuthUser): string[] {
  return user.keepers.map((k) => k.warehouseId);
}

export function isAdmin(user: AuthUser): boolean {
  return hasPermission(rolePermissions(user), 'manage_roles');
}

/** Админ или роль с edit_all — обход ограничений «только своё». */
export function isPrivilegedStaff(user: AuthUser): boolean {
  const perms = rolePermissions(user);
  return (
    hasPermission(perms, 'manage_roles') || hasPermission(perms, 'edit_all')
  );
}

/** Полное редактирование любой карточки. */
export function canEditAllItems(user: AuthUser): boolean {
  const perms = rolePermissions(user);
  return (
    hasPermission(perms, 'edit_all') || hasPermission(perms, 'manage_roles')
  );
}

export function canEditDocuments(
  user: AuthUser,
  item: {
    ownerType: string;
    ownerUserId?: string | null;
    ownerWarehouseId?: string | null;
  },
): boolean {
  return canActOnItem(user, item);
}

export function canDeleteItem(
  user: AuthUser,
  item: {
    ownerType: string;
    ownerUserId?: string | null;
    ownerWarehouseId?: string | null;
  },
): boolean {
  return (
    hasPermission(rolePermissions(user), 'delete') && canActOnItem(user, item)
  );
}

export function canActOnItem(
  user: AuthUser,
  item: {
    ownerType: string;
    ownerUserId?: string | null;
    ownerWarehouseId?: string | null;
  },
): boolean {
  if (isPrivilegedStaff(user)) {
    return true;
  }
  if (item.ownerType === 'USER' && item.ownerUserId === user.id) {
    return true;
  }
  if (
    item.ownerType === 'WAREHOUSE' &&
    item.ownerWarehouseId &&
    isWarehouseKeeper(user, item.ownerWarehouseId)
  ) {
    return true;
  }
  return false;
}

export function canTransferFrom(
  user: AuthUser,
  item: {
    ownerType: string;
    ownerUserId?: string | null;
    ownerWarehouseId?: string | null;
  },
): boolean {
  return (
    hasPermission(rolePermissions(user), 'transfer') && canActOnItem(user, item)
  );
}

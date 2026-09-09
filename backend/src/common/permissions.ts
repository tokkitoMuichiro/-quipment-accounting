export const ALL_PERMISSIONS = [
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
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_own: 'Видеть своё оборудование',
  view_all: 'Видеть всё оборудование',
  create: 'Создавать карточки',
  edit: 'Редактировать своё оборудование',
  edit_all: 'Редактировать любое оборудование',
  edit_condition: 'Менять состояние оборудования',
  delete: 'Удалять карточки',
  transfer: 'Передавать оборудование',
  manage_warehouses: 'Управлять производственными базами',
  manage_roles: 'Настраивать роли и пользователей',
  export_excel: 'Выгружать Excel',
};

export function hasPermission(
  permissions: unknown,
  needed: Permission | Permission[],
): boolean {
  const list = Array.isArray(permissions) ? permissions : [];
  const required = Array.isArray(needed) ? needed : [needed];
  return required.every((p) => list.includes(p));
}

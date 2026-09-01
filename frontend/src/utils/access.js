export function canTransferItem(auth, item) {
  if (!item || !auth?.user || !auth.can('transfer')) return false;
  if (auth.can('edit') || auth.can('manage_roles')) return true;
  if (item.ownerType === 'USER' && item.ownerUserId === auth.user.id) return true;
  const warehouseIds = auth.user.warehouseIds || [];
  return (
    item.ownerType === 'WAREHOUSE' &&
    Boolean(item.ownerWarehouseId) &&
    warehouseIds.includes(item.ownerWarehouseId)
  );
}

export function canChangeConditionItem(auth, item) {
  if (!item || !auth?.user) return false;
  if (auth.can('edit') || auth.can('manage_roles')) return true;
  if (!auth.can('edit_condition')) return false;
  if (item.ownerType === 'USER' && item.ownerUserId === auth.user.id) return true;
  const warehouseIds = auth.user.warehouseIds || [];
  return (
    item.ownerType === 'WAREHOUSE' &&
    Boolean(item.ownerWarehouseId) &&
    warehouseIds.includes(item.ownerWarehouseId)
  );
}

export function canOpenWarehouse() {
  return true;
}

export function canStockWarehouse(auth, warehouseId) {
  if (!auth?.user || !auth.can('create')) return false;
  if (auth.can('edit') || auth.can('manage_roles') || auth.can('manage_warehouses')) {
    return true;
  }
  return (auth.user.warehouseIds || []).includes(warehouseId);
}

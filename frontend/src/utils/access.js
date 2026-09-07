function isPrivileged(auth) {
  return Boolean(auth?.can?.('edit') || auth?.can?.('manage_roles'));
}

function ownsItem(auth, item) {
  if (!item || !auth?.user) return false;
  if (item.ownerType === 'USER' && item.ownerUserId === auth.user.id) return true;
  const warehouseIds = auth.user.warehouseIds || [];
  return (
    item.ownerType === 'WAREHOUSE' &&
    Boolean(item.ownerWarehouseId) &&
    warehouseIds.includes(item.ownerWarehouseId)
  );
}

function canActOnItem(auth, item) {
  return isPrivileged(auth) || ownsItem(auth, item);
}

export function canTransferItem(auth, item) {
  if (!item || !auth?.user || !auth.can('transfer')) return false;
  if (isPendingAccept(item)) return false;
  return canActOnItem(auth, item);
}

export function isPendingAccept(item) {
  return item?.pendingTransfer?.status === 'PENDING';
}

export function canAcceptTransfer(auth, item) {
  if (!item || !auth?.user || !isPendingAccept(item)) return false;
  if (isPrivileged(auth)) return true;
  return item.pendingTransfer.toUserId === auth.user.id;
}

export function canCancelPendingTransfer(auth, item) {
  if (!item || !auth?.user || !isPendingAccept(item)) return false;
  if (isPrivileged(auth)) return true;
  if (item.pendingTransfer.actorUserId === auth.user.id) return true;
  return ownsItem(auth, item);
}

export function canChangeConditionItem(auth, item) {
  if (!item || !auth?.user) return false;
  if (isPendingAccept(item)) return false;
  if (isPrivileged(auth)) return true;
  if (!auth.can('edit_condition')) return false;
  return ownsItem(auth, item);
}

export function canEditDocumentsItem(auth, item) {
  return canActOnItem(auth, item);
}

export function canDeleteItem(auth, item) {
  if (!item || !auth?.user || !auth.can('delete')) return false;
  if (isPendingAccept(item)) return false;
  return canActOnItem(auth, item);
}

export function canStockWarehouse(auth, warehouseId) {
  if (!auth?.user || !auth.can('create')) return false;
  if (isPrivileged(auth) || auth.can('manage_warehouses')) return true;
  return (auth.user.warehouseIds || []).includes(warehouseId);
}

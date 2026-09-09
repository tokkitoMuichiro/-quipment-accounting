function isPrivileged(auth) {
  return Boolean(auth?.can?.('edit_all') || auth?.can?.('manage_roles'));
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
  if (isFillBlocked(item)) return false;
  return canActOnItem(auth, item);
}

export function isPendingAccept(item) {
  return item?.pendingTransfer?.status === 'PENDING';
}

export function isFillNeedsFix(item) {
  return item?.fillStatus === 'NEEDS_FIX';
}

export function isFillPendingReview(item) {
  return item?.fillStatus === 'PENDING_REVIEW';
}

export function isFillBlocked(item) {
  return isFillNeedsFix(item) || isFillPendingReview(item);
}

export function canEditItemCard(auth, item) {
  if (!item || !auth?.user) return false;
  if (isPrivileged(auth)) return true;
  if (auth.can('edit') && ownsItem(auth, item)) return true;
  if (!isFillBlocked(item)) return false;
  return ownsItem(auth, item);
}

export function canFlagFill(auth, item) {
  if (!item || !auth?.user || !auth.can('manage_roles')) return false;
  if (isPendingAccept(item)) return false;
  return true;
}

export function canConfirmFill(auth, item) {
  if (!item || !auth?.user || !auth.can('manage_roles')) return false;
  return isFillBlocked(item);
}

export function canAcceptTransfer(auth, item) {
  if (!item || !auth?.user || !isPendingAccept(item)) return false;
  if (isPrivileged(auth)) return true;
  const pending = item.pendingTransfer;
  if (pending.toOwnerType === 'USER') {
    return pending.toUserId === auth.user.id;
  }
  if (pending.toOwnerType === 'WAREHOUSE' && pending.toWarehouseId) {
    return (auth.user.warehouseIds || []).includes(pending.toWarehouseId);
  }
  return false;
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

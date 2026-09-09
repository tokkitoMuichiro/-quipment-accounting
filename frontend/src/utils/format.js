export const CONDITION_LABEL = {
  OK: 'Исправное',
  NEEDS_REPAIR: 'Требует ремонта',
  IN_REPAIR: 'В ремонте',
  IRREPARABLE: 'Не подлежит ремонту',
};

export const CONDITION_OPTIONS = [
  { value: 'OK', label: 'Исправное' },
  { value: 'NEEDS_REPAIR', label: 'Требует ремонта' },
  { value: 'IN_REPAIR', label: 'В ремонте' },
  { value: 'IRREPARABLE', label: 'Не подлежит ремонту' },
];

export const CONDITIONS_NEEDING_NOTE = ['NEEDS_REPAIR', 'IN_REPAIR', 'IRREPARABLE'];

export const CONDITION_TONE = {
  OK: 'ok',
  NEEDS_REPAIR: 'warn',
  IN_REPAIR: 'repair',
  IRREPARABLE: 'bad',
};

export function conditionNeedsNote(condition) {
  return CONDITIONS_NEEDING_NOTE.includes(condition);
}

export const TRANSFER_STATUS_LABEL = {
  PENDING: 'Ждёт принятия',
  COMPLETED: 'Выполнена',
  CANCELLED: 'Отменена',
};

export function ownerLabel(item) {
  if (item.ownerType === 'USER') {
    return item.ownerUser?.fullName || 'Сотрудник';
  }
  return item.ownerWarehouse
    ? `База: ${item.ownerWarehouse.name}`
    : 'Производственная база';
}

export function pendingOfferLabel(item) {
  const pending = item?.pendingTransfer;
  if (pending?.status !== 'PENDING') return '';
  const to = pending.toLabel || 'сотруднику';
  if (item.type !== 'SERIAL' && pending.quantity && pending.quantity !== item.quantity) {
    return `→ ${to} (${pending.quantity} шт.)`;
  }
  return `→ ${to}`;
}

export function repairSenderLabel(item) {
  return item?.sentToRepairBy?.fullName || '';
}

export const FILL_STATUS_LABEL = {
  OK: '',
  NEEDS_FIX: 'Неверно заполнено',
  PENDING_REVIEW: 'Ожидает проверки',
};

export function typeLabel(item) {
  return item.type === 'SERIAL' ? 'Серийное' : 'Неномерное';
}

export function formatDate(value) {
  return new Date(value).toLocaleString('ru-RU');
}

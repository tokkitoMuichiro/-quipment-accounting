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

export const VEHICLE_KIND_OPTIONS = [
  { value: 'PASSENGER', label: 'Легковой' },
  { value: 'TRUCK', label: 'Грузовой' },
  { value: 'SPECIAL', label: 'Спецтехника' },
  { value: 'MOTORCYCLE', label: 'Мотоцикл' },
  { value: 'TRAILER', label: 'Прицеп' },
];

export const CARD_KIND_OPTIONS = [
  { value: 'TRANSPONDER', label: 'Транспондер' },
  { value: 'FUEL', label: 'Топливная карта' },
  { value: 'BUSINESS', label: 'Бизнес-карта' },
];

export function vehicleKindLabel(kind) {
  return VEHICLE_KIND_OPTIONS.find((o) => o.value === kind)?.label || kind || '';
}

export function cardKindLabel(kind) {
  return CARD_KIND_OPTIONS.find((o) => o.value === kind)?.label || kind || '';
}

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
  if (item.category === 'VEHICLE') {
    return vehicleKindLabel(item.vehicleKind) || 'Транспорт';
  }
  if (item.category === 'CARD') {
    return cardKindLabel(item.cardKind) || 'Карта';
  }
  return item.type === 'SERIAL' ? 'Серийное' : 'Неномерное';
}

export function identityLabel(item) {
  if (item.category === 'VEHICLE') return item.plateNumber || '—';
  if (item.category === 'CARD') {
    if (item.cardKind === 'BUSINESS' && item.cardNumber) {
      return `****${item.cardNumber}`;
    }
    return item.cardNumber || '—';
  }
  return item.factoryNumber || '—';
}

export function identityColumnTitle(category) {
  if (category === 'VEHICLE') return 'Госномер';
  if (category === 'CARD') return 'Номер';
  return 'Заводской номер';
}

export function searchBlob(item) {
  return [
    item.name,
    item.factoryNumber,
    item.plateNumber,
    item.cardNumber,
    vehicleKindLabel(item.vehicleKind),
    cardKindLabel(item.cardKind),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function formatDate(value) {
  return new Date(value).toLocaleString('ru-RU');
}

export function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function categoryFromRoute(metaCategory) {
  const value = (metaCategory || 'equipment').toLowerCase();
  if (value === 'vehicle' || value === 'vehicles') return 'VEHICLE';
  if (value === 'card' || value === 'cards') return 'CARD';
  return 'EQUIPMENT';
}

export function categoryQueryParam(category) {
  if (category === 'VEHICLE') return 'vehicle';
  if (category === 'CARD') return 'card';
  return 'equipment';
}

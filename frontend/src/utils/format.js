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

export function ownerLabel(item) {
  if (item.ownerType === 'USER') {
    return item.ownerUser?.fullName || 'Сотрудник';
  }
  return item.ownerWarehouse
    ? `База: ${item.ownerWarehouse.name}`
    : 'Производственная база';
}

export function typeLabel(item) {
  return item.type === 'SERIAL' ? 'Серийное' : 'Расходник';
}

export function formatDate(value) {
  return new Date(value).toLocaleString('ru-RU');
}

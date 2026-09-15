import { AssetCategory, CardKind, Equipment } from '@prisma/client';

const VEHICLE_KIND_LABEL: Record<string, string> = {
  PASSENGER: 'Легковой',
  TRUCK: 'Грузовой',
  SPECIAL: 'Спецтехника',
  MOTORCYCLE: 'Мотоцикл',
  TRAILER: 'Прицеп',
};

const CARD_KIND_LABEL: Record<string, string> = {
  TRANSPONDER: 'Транспондер',
  FUEL: 'Топливная карта',
  BUSINESS: 'Бизнес-карта',
};

export function vehicleKindLabel(kind?: string | null): string {
  return (kind && VEHICLE_KIND_LABEL[kind]) || kind || '';
}

export function cardKindLabel(kind?: string | null): string {
  return (kind && CARD_KIND_LABEL[kind]) || kind || '';
}

export function parseAssetCategory(raw?: string | null): AssetCategory {
  const value = (raw || 'equipment').trim().toLowerCase();
  if (value === 'vehicle') return 'VEHICLE';
  if (value === 'card') return 'CARD';
  return 'EQUIPMENT';
}

export function assetDisplayName(
  item: Pick<
    Equipment,
    'name' | 'category' | 'plateNumber' | 'cardKind' | 'cardNumber'
  >,
): string {
  if (item.category === 'VEHICLE' && item.plateNumber) {
    return `${item.name} (${item.plateNumber})`;
  }
  if (item.category === 'CARD') {
    const kind = cardKindLabel(item.cardKind);
    const num = item.cardNumber || '';
    if (item.cardKind === 'BUSINESS') {
      return `${kind} ****${num}`.trim();
    }
    return num ? `${kind} ${num}`.trim() : item.name;
  }
  return item.name;
}

export function defaultCardName(
  cardKind: CardKind,
  cardNumber: string,
  name?: string | null,
): string {
  const trimmed = name?.trim();
  if (trimmed && trimmed.length >= 2) {
    return trimmed;
  }
  if (cardKind === 'FUEL') {
    return `Топливная карта ${cardNumber}`;
  }
  if (cardKind === 'BUSINESS') {
    return `Бизнес-карта ****${cardNumber}`;
  }
  return `Транспондер ${cardNumber}`;
}

export function normalizeCardNumber(
  cardKind: CardKind,
  raw: string,
): string {
  const value = raw.trim();
  if (cardKind === 'BUSINESS') {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 4) {
      throw new Error('Для бизнес-карты укажите последние 4 цифры');
    }
    return digits;
  }
  if (!value) {
    throw new Error('Укажите номер карты');
  }
  return value;
}

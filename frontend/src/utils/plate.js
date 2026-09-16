const PLATE_LETTERS = 'ABEKMHOPCTYXАВЕКМНОРСТУХ';

const CYR_TO_LAT = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  У: 'Y',
  Х: 'X',
};

const CAR_RE = new RegExp(`^[${PLATE_LETTERS}]\\d{3}[${PLATE_LETTERS}]{2}\\d{1,3}$`, 'i');
const TRAILER_RE = new RegExp(`^[${PLATE_LETTERS}]{2}\\d{4}\\d{1,3}$`, 'i');

export function normalizePlate(raw) {
  return String(raw || '')
    .replace(/[\s-]/g, '')
    .toUpperCase()
    .split('')
    .map((ch) => CYR_TO_LAT[ch] || ch)
    .join('');
}

export function isValidPlate(raw, vehicleKind) {
  if (!String(raw || '').trim()) return false;
  const re = vehicleKind === 'TRAILER' ? TRAILER_RE : CAR_RE;
  return re.test(normalizePlate(raw));
}

export function platePlaceholder(vehicleKind) {
  return vehicleKind === 'TRAILER' ? 'АА1234 199' : 'A123BC77';
}

export function plateHint(vehicleKind) {
  return vehicleKind === 'TRAILER'
    ? 'Формат прицепа: 2 буквы, 4 цифры и регион (1–3 цифры)'
    : 'Формат: буква, 3 цифры, 2 буквы и регион (1–3 цифры)';
}

/** Letters allowed on RU plates (Cyrillic) and their Latin lookalikes. */
const PLATE_LETTER_CLASS = 'ABEKMHOPCTYXАВЕКМНОРСТУХ';

const PLATE_RE = new RegExp(
  `^[${PLATE_LETTER_CLASS}]\\d{3}[${PLATE_LETTER_CLASS}]{2}\\d{1,3}$`,
  'i',
);

/** Trailers use two letters, four digits and a region: АА1234 199. */
const TRAILER_PLATE_RE = new RegExp(
  `^[${PLATE_LETTER_CLASS}]{2}\\d{4}\\d{1,3}$`,
  'i',
);

const CYR_TO_LAT: Record<string, string> = {
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

export const PLATE_FORMAT_HINT =
  'Госномер: буква, 3 цифры, 2 буквы и регион (1–3 цифры), например A123BC77';

export const TRAILER_PLATE_FORMAT_HINT =
  'Госномер прицепа: 2 буквы, 4 цифры и регион (1–3 цифры), например AA1234 199';

export function normalizePlateNumber(raw: string): string {
  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase();
  return cleaned
    .split('')
    .map((ch) => CYR_TO_LAT[ch] || ch)
    .join('');
}

function patternFor(vehicleKind?: string | null): RegExp {
  return vehicleKind === 'TRAILER' ? TRAILER_PLATE_RE : PLATE_RE;
}

export function plateFormatHint(vehicleKind?: string | null): string {
  return vehicleKind === 'TRAILER'
    ? TRAILER_PLATE_FORMAT_HINT
    : PLATE_FORMAT_HINT;
}

export function isValidPlateNumber(
  raw: string,
  vehicleKind?: string | null,
): boolean {
  if (!raw?.trim()) return false;
  return patternFor(vehicleKind).test(normalizePlateNumber(raw));
}

export function assertPlateNumber(
  raw: string,
  vehicleKind?: string | null,
): string {
  const normalized = normalizePlateNumber(raw);
  if (!patternFor(vehicleKind).test(normalized)) {
    throw new Error(plateFormatHint(vehicleKind));
  }
  return normalized;
}

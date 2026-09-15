/** Letters allowed on RU plates (Cyrillic) and their Latin lookalikes. */
const PLATE_LETTER_CLASS = 'ABEKMHOPCTYXАВЕКМНОРСТУХ';

const PLATE_RE = new RegExp(
  `^[${PLATE_LETTER_CLASS}]\\d{3}[${PLATE_LETTER_CLASS}]{2}\\d{1,3}$`,
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

export function normalizePlateNumber(raw: string): string {
  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase();
  return cleaned
    .split('')
    .map((ch) => CYR_TO_LAT[ch] || ch)
    .join('');
}

export function isValidPlateNumber(raw: string): boolean {
  if (!raw?.trim()) return false;
  const normalized = normalizePlateNumber(raw);
  return PLATE_RE.test(normalized);
}

export function assertPlateNumber(raw: string): string {
  const normalized = normalizePlateNumber(raw);
  if (!PLATE_RE.test(normalized)) {
    throw new Error(
      'Госномер: буква, 3 цифры, 2 буквы и регион (1–3 цифры), например A123BC77',
    );
  }
  return normalized;
}

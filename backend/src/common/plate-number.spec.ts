import {
  assertPlateNumber,
  isValidPlateNumber,
  normalizePlateNumber,
} from './plate-number';

describe('plate-number', () => {
  it('accepts latin and cyrillic plates with 1–3 digit region', () => {
    expect(isValidPlateNumber('A123BC7')).toBe(true);
    expect(isValidPlateNumber('A123BC77')).toBe(true);
    expect(isValidPlateNumber('A123BC777')).toBe(true);
    expect(isValidPlateNumber('А123ВС777')).toBe(true);
    expect(isValidPlateNumber('а 123 вс 77')).toBe(true);
  });

  it('rejects invalid shapes', () => {
    expect(isValidPlateNumber('123ABC77')).toBe(false);
    expect(isValidPlateNumber('A12BC77')).toBe(false);
    expect(isValidPlateNumber('A123BC7777')).toBe(false);
    expect(isValidPlateNumber('')).toBe(false);
  });

  it('normalizes cyrillic to latin uppercase', () => {
    expect(normalizePlateNumber('а123вс77')).toBe('A123BC77');
    expect(assertPlateNumber('А123ВС777')).toBe('A123BC777');
  });
});

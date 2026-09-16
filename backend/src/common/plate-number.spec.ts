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

  it('accepts trailer plates: two letters, four digits, region', () => {
    expect(isValidPlateNumber('AA1234 199', 'TRAILER')).toBe(true);
    expect(isValidPlateNumber('АА1234199', 'TRAILER')).toBe(true);
    expect(isValidPlateNumber('ак 1234 7', 'TRAILER')).toBe(true);
    expect(assertPlateNumber('АА1234 199', 'TRAILER')).toBe('AA1234199');
  });

  it('rejects trailer plates in the wrong shape', () => {
    expect(isValidPlateNumber('A123BC77', 'TRAILER')).toBe(false);
    expect(isValidPlateNumber('AA1234', 'TRAILER')).toBe(false);
    expect(isValidPlateNumber('AA1234 1999', 'TRAILER')).toBe(false);
    expect(isValidPlateNumber('A1234 199', 'TRAILER')).toBe(false);
  });

  it('keeps the car shape invalid for trailers and vice versa', () => {
    expect(isValidPlateNumber('AA1234199')).toBe(false);
    expect(isValidPlateNumber('A123BC77', 'PASSENGER')).toBe(true);
  });
});

import {
  decodeUploadFileName,
  equipmentFolderName,
  equipmentFolderNameUnique,
  sanitizeBitrixDiskName,
} from './document.constants';

describe('sanitizeBitrixDiskName', () => {
  it('strips characters rejected by Bitrix Disk', () => {
    expect(sanitizeBitrixDiskName('насос 2"/A:B?*.pdf')).toBe('насос 2 A B.pdf');
  });

  it('keeps normal names', () => {
    expect(sanitizeBitrixDiskName('паспорт СТС.pdf')).toBe('паспорт СТС.pdf');
  });
});

describe('equipmentFolderName', () => {
  it('builds equipment name with factory number', () => {
    expect(
      equipmentFolderName({
        id: 'abcdefgh-1234',
        name: 'насос УОДН',
        factoryNumber: 'SN-42',
        category: 'EQUIPMENT',
      }),
    ).toBe('насос УОДН SN-42');
  });

  it('builds vehicle name with plate', () => {
    expect(
      equipmentFolderName({
        id: 'abcdefgh-1234',
        name: 'Газель',
        plateNumber: 'А123ВС77',
        category: 'VEHICLE',
      }),
    ).toBe('Газель А123ВС77');
  });

  it('falls back to short id', () => {
    expect(
      equipmentFolderName({
        id: 'abcdefgh-1234',
        name: ' ',
        category: 'EQUIPMENT',
      }),
    ).toBe('Позиция abcdefgh');
  });

  it('sanitizes illegal characters in equipment name', () => {
    expect(
      equipmentFolderName({
        id: 'abcdefgh-1234',
        name: 'Клапан DN50 3/4"',
        factoryNumber: 'A:1',
        category: 'EQUIPMENT',
      }),
    ).toBe('Клапан DN50 3 4 A 1');
  });
});

describe('equipmentFolderNameUnique', () => {
  it('appends short id so same-name items do not collide', () => {
    expect(
      equipmentFolderNameUnique({
        id: 'abcdefgh-1234',
        name: 'Болт М8',
        category: 'EQUIPMENT',
      }),
    ).toBe('Болт М8 abcdefgh');
  });
});

describe('decodeUploadFileName', () => {
  it('fixes latin1-misread UTF-8 filenames', () => {
    const garbled = Buffer.from('СТС Камаз.pdf', 'utf8').toString('latin1');
    expect(decodeUploadFileName(garbled)).toBe('СТС Камаз.pdf');
  });

  it('keeps normal utf8 names', () => {
    expect(decodeUploadFileName('паспорт.pdf')).toBe('паспорт.pdf');
  });

  it('sanitizes illegal filename characters', () => {
    expect(decodeUploadFileName('схема A/B:1?.pdf')).toBe('схема A_B 1.pdf');
  });
});

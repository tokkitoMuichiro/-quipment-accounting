import { equipmentFolderName } from '../bitrix/document.constants';

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
});

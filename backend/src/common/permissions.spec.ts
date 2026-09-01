import { hasPermission } from './permissions';

describe('hasPermission', () => {
  it('requires every listed permission', () => {
    expect(hasPermission(['view_own', 'transfer'], 'view_own')).toBe(true);
    expect(hasPermission(['view_own'], ['view_own', 'transfer'])).toBe(false);
    expect(hasPermission(['view_own', 'transfer'], ['view_own', 'transfer'])).toBe(
      true,
    );
    expect(hasPermission(null, 'view_own')).toBe(false);
  });
});

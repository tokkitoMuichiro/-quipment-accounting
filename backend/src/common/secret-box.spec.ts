import { deriveSecretKey, openSecret, sealSecret } from './secret-box';

describe('secret-box', () => {
  const key = deriveSecretKey('test-secret');

  it('round-trips plaintext', () => {
    const sealed = sealSecret('hello-token', key);
    expect(sealed.startsWith('enc:v1:')).toBe(true);
    expect(openSecret(sealed, key)).toBe('hello-token');
  });

  it('leaves legacy plaintext unchanged on open', () => {
    expect(openSecret('plain-legacy', key)).toBe('plain-legacy');
  });

  it('does not double-encrypt', () => {
    const once = sealSecret('x', key);
    expect(sealSecret(once, key)).toBe(once);
  });
});

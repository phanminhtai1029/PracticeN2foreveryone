import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../worker/auth';

describe('password hashing', () => {
  it('verifies the right password', async () => {
    const h = await hashPassword('secret123');
    expect(h).toMatch(/^pbkdf2\$100000\$/);
    expect(await verifyPassword('secret123', h)).toBe(true);
  });
  it('rejects a wrong password', async () => {
    expect(await verifyPassword('nope', await hashPassword('secret123'))).toBe(false);
  });
  it('salts hashes', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });
  it('rejects malformed stored hash', async () => {
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});

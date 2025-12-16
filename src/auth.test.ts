// src/auth.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword } from './auth'; // Assuming hashPassword is exported

describe('hashPassword', () => {
  it('should return a hash and salt for a given password', async () => {
    const password = 'mySecurePassword123';
    const { hash, salt } = await hashPassword(password);

    expect(hash).toBeTypeOf('string');
    expect(hash.length).toBeGreaterThan(0);
    expect(salt).toBeTypeOf('string');
    expect(salt.length).toBeGreaterThan(0);
  });

  it('should return different hashes for different salts with the same password', async () => {
    const password = 'mySecurePassword123';
    
    const { hash: hash1, salt: salt1 } = await hashPassword(password);
    const { hash: hash2, salt: salt2 } = await hashPassword(password);

    expect(hash1).not.toEqual(hash2);
    expect(salt1).not.toEqual(salt2);
  });

  it('should return the same hash for the same password and same salt', async () => {
    const password = 'mySecurePassword123';
    const originalSalt = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'; // Example fixed salt

    const { hash: hash1 } = await hashPassword(password, originalSalt);
    const { hash: hash2 } = await hashPassword(password, originalSalt);

    expect(hash1).toEqual(hash2);
  });
});
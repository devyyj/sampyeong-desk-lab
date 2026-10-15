import { describe, it, expect } from 'vitest';
import { hashPIN, verifyPIN, isValidPin, INITIAL_PIN } from './auth-utils';

describe('Auth Utils', () => {
  it('should hash a 4-digit PIN and verify it correctly', async () => {
    const pin = '1234';
    const hashed = await hashPIN(pin);
    
    expect(hashed).not.toBe(pin);
    
    const isValid = await verifyPIN(pin, hashed);
    expect(isValid).toBe(true);
    
    const isInvalid = await verifyPIN('4321', hashed);
    expect(isInvalid).toBe(false);
  });
  
  it('should reject invalid PIN formats during hashing', async () => {
    await expect(hashPIN('123')).rejects.toThrow(); // Too short
    await expect(hashPIN('12345')).rejects.toThrow(); // Too long
    await expect(hashPIN('abcd')).rejects.toThrow(); // Not digits
  });

  it('isValidPin: 4자리 숫자 문자열만 true', () => {
    expect(['1234', '0000'].map(isValidPin)).toEqual([true, true]);
    expect(['123', '12345', 'abcd', ' 1234', null, undefined].map(isValidPin)).toEqual([false, false, false, false, false, false]);
    expect(INITIAL_PIN).toBe('1234');
  });
});

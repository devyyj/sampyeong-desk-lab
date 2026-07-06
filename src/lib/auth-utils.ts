import bcrypt from 'bcryptjs';

/**
 * Validates and hashes a 4-digit PIN.
 * @param pin The 4-digit numeric string
 * @returns The hashed PIN string
 */
export async function hashPIN(pin: string): Promise<string> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be exactly 4 digits');
  }
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin, salt);
}

/**
 * Verifies a PIN against a hashed PIN.
 * @param pin The raw PIN provided by the user
 * @param hashedPin The hashed PIN from the database
 * @returns true if they match, false otherwise
 */
export async function verifyPIN(pin: string, hashedPin: string): Promise<boolean> {
  return bcrypt.compare(pin, hashedPin);
}

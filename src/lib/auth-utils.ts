import bcrypt from 'bcryptjs';

/** 관리자가 계정을 발급하거나 PIN을 초기화할 때 쓰는 기본 PIN. 이 PIN을 받은 사용자는 첫 로그인 때 변경해야 한다. */
export const INITIAL_PIN = '1234';

/** 관리자가 나눠 주는 공개된 초기 PIN은 본인 PIN으로 고를 수 없다(누구나 아는 값이므로). */
export const INITIAL_PIN_REJECTED = '초기 비밀번호(1234)는 사용할 수 없습니다.';

/** PIN 형식 검증: 정확히 4자리 숫자 문자열 (FormData 값이 null일 수 있어 unknown을 받는다) */
export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

/**
 * Validates and hashes a 4-digit PIN.
 * @param pin The 4-digit numeric string
 * @returns The hashed PIN string
 */
export async function hashPIN(pin: string): Promise<string> {
  if (!isValidPin(pin)) {
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

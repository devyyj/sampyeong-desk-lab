// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';
import { encrypt, decrypt, createSession, deleteSession, getSession, resolveSessionSecret } from './session';

// SESSION_SECRET 미설정 시 session.ts가 쓰는 개발용 기본 키
const KEY = new TextEncoder().encode('super-secret-key-for-development');

vi.mock('next/headers', () => {
  const cookieStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };
  return {
    cookies: vi.fn(() => cookieStore),
  };
});

describe('session utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('encrypts and decrypts payload correctly', async () => {
    const payload = { userId: '123', username: 'testuser', isAdmin: false, mustChangePin: false, expiresAt: new Date() };
    const encrypted = await encrypt(payload);
    expect(encrypted).toBeTypeOf('string');

    const decrypted = await decrypt(encrypted);
    expect(decrypted?.userId).toBe('123');
    expect(decrypted?.username).toBe('testuser');
  });

  it('관리자/PIN 변경 필요 플래그를 세션에 담고 복원', async () => {
    const token = await encrypt({ userId: '1', username: 'a', isAdmin: true, mustChangePin: true, expiresAt: new Date() });
    expect(await decrypt(token)).toMatchObject({ isAdmin: true, mustChangePin: true });
  });

  it('플래그가 없는 예전 토큰은 false로 해석', async () => {
    const legacy = await new SignJWT({ userId: '1', username: 'a' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(KEY);
    expect(await decrypt(legacy)).toMatchObject({ isAdmin: false, mustChangePin: false });
  });

  it('returns null for invalid token decryption', async () => {
    const decrypted = await decrypt('invalid-token');
    expect(decrypted).toBeNull();
  });

  it('createSession sets a cookie', async () => {
    const { cookies } = await import('next/headers');
    await createSession('123', 'testuser', { isAdmin: false, mustChangePin: false });
    
    const cookieStore = await cookies();
    expect(cookieStore.set).toHaveBeenCalledWith(
      'session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
  });

  it('deleteSession deletes a cookie', async () => {
    const { cookies } = await import('next/headers');
    await deleteSession();
    
    const cookieStore = await cookies();
    expect(cookieStore.delete).toHaveBeenCalledWith('session');
  });

  it('getSession retrieves and decrypts the session', async () => {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    
    const token = await encrypt({ userId: '123', username: 'testuser', isAdmin: false, mustChangePin: false, expiresAt: new Date() });
    vi.mocked(cookieStore.get).mockReturnValue({ value: token, name: 'session' });

    const session = await getSession();
    expect(session?.userId).toBe('123');
    expect(session?.username).toBe('testuser');
  });

  it('getSession returns null if no session cookie exists', async () => {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    vi.mocked(cookieStore.get).mockReturnValue(undefined);

    const session = await getSession();
    expect(session).toBeNull();
  });
});

describe('resolveSessionSecret', () => {
  const STRONG = 'x'.repeat(32);

  it('SESSION_SECRET이 있으면 그 값을 쓴다', () => {
    expect(resolveSessionSecret({ SESSION_SECRET: STRONG, NODE_ENV: 'production' })).toBe(STRONG);
  });

  it('개발/테스트 환경에서는 없으면 개발용 기본 키', () => {
    expect(resolveSessionSecret({ NODE_ENV: 'development' })).toBe('super-secret-key-for-development');
    expect(resolveSessionSecret({ NODE_ENV: 'test' })).toBe('super-secret-key-for-development');
  });

  it('production에서 없으면 공개된 기본 키로 서명하지 않고 오류', () => {
    expect(() => resolveSessionSecret({ NODE_ENV: 'production' })).toThrow('SESSION_SECRET');
    expect(() => resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: '' })).toThrow('SESSION_SECRET');
  });

  it('production에서 32자 미만이면 오류(추측 가능한 약한 키 방지)', () => {
    expect(() => resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'short' })).toThrow('32');
  });
});

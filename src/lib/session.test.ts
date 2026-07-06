// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encrypt, decrypt, createSession, deleteSession, getSession } from './session';

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
    const payload = { userId: '123', username: 'testuser', expiresAt: new Date() };
    const encrypted = await encrypt(payload);
    expect(encrypted).toBeTypeOf('string');

    const decrypted = await decrypt(encrypted);
    expect(decrypted?.userId).toBe('123');
    expect(decrypted?.username).toBe('testuser');
  });

  it('returns null for invalid token decryption', async () => {
    const decrypted = await decrypt('invalid-token');
    expect(decrypted).toBeNull();
  });

  it('createSession sets a cookie', async () => {
    const { cookies } = await import('next/headers');
    await createSession('123', 'testuser');
    
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
    
    const token = await encrypt({ userId: '123', username: 'testuser', expiresAt: new Date() });
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

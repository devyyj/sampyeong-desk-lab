import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signup, login, logout } from './auth';
import { db } from '@/db';
import { users } from '../../../drizzle/schema';
import * as authUtils from '@/lib/auth-utils';
import * as session from '@/lib/session';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  hashPIN: vi.fn(),
  verifyPIN: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('auth server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signup', () => {
    it('returns error if fields are missing', async () => {
      const formData = new FormData();
      const result = await signup(null, formData);
      expect(result).toEqual({ error: '모든 항목을 입력해주세요.' });
    });

    it('returns error if PINs do not match', async () => {
      const formData = new FormData();
      formData.append('username', 'test');
      formData.append('department', 'dev');
      formData.append('pin', '1234');
      formData.append('confirmPin', '4321');
      const result = await signup(null, formData);
      expect(result).toEqual({ error: '비밀번호가 일치하지 않습니다.' });
    });

    it('returns error if PIN is invalid', async () => {
      const formData = new FormData();
      formData.append('username', 'test');
      formData.append('department', 'dev');
      formData.append('pin', '123');
      formData.append('confirmPin', '123');
      const result = await signup(null, formData);
      expect(result).toEqual({ error: '비밀번호는 4자리 숫자여야 합니다.' });
    });
  });

  describe('login', () => {
    it('returns error if fields are missing', async () => {
      const formData = new FormData();
      const result = await login(null, formData);
      expect(result).toEqual({ error: '아이디와 비밀번호를 입력해주세요.' });
    });
  });

  describe('logout', () => {
    it('deletes session and redirects', async () => {
      const { redirect } = await import('next/navigation');
      await logout();
      expect(session.deleteSession).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith('/login');
    });
  });
});

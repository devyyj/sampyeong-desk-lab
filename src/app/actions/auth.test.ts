import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { signup, login, logout } from './auth';
import { db } from '@/db';
import { users } from '../../../drizzle/schema';
import * as authUtils from '@/lib/auth-utils';
import * as session from '@/lib/session';

// vi.mock으로 바꾼 체이닝 메서드(where/set 등)는 실제 db 타입에 없으므로 mock 타입으로 한 번만 캐스팅해 쓴다.
const mockDb = db as unknown as Record<'select' | 'from' | 'where' | 'insert' | 'values' | 'returning' | 'update' | 'set', Mock>;

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
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

  // Confluence에서 이관된 사전 등록 계정(pin_hash NULL)을 같은 아이디로 가입 시 연결(claim)
  describe('signup: 사전 등록 계정 연결', () => {
    const signupForm = () => {
      const formData = new FormData();
      formData.append('username', 'kim.test');
      formData.append('department', '개발팀');
      formData.append('pin', '1234');
      formData.append('confirmPin', '1234');
      return formData;
    };

    beforeEach(() => {
      vi.mocked(authUtils.hashPIN).mockResolvedValue('hashed');
    });

    it('pin_hash가 NULL인 사전 등록 계정이면 INSERT 대신 UPDATE로 연결하고 세션 생성', async () => {
      // 1번째 where: 기존 사용자 조회, 2번째 where: UPDATE ... RETURNING
      mockDb.where
        .mockResolvedValueOnce([{ id: 'u1', username: 'kim.test', pinHash: null }])
        .mockReturnValueOnce({ returning: vi.fn().mockResolvedValue([{ id: 'u1', username: 'kim.test' }]) });

      await signup(null, signupForm());

      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ pinHash: 'hashed', department: '개발팀' }));
      expect(session.createSession).toHaveBeenCalledWith('u1', 'kim.test', { isAdmin: false, mustChangePin: false });
    });

    it('UPDATE가 0행이면(동시 가입 경합) 이미 존재 오류이고 세션을 만들지 않음', async () => {
      mockDb.where
        .mockResolvedValueOnce([{ id: 'u1', username: 'kim.test', pinHash: null }])
        .mockReturnValueOnce({ returning: vi.fn().mockResolvedValue([]) });

      const result = await signup(null, signupForm());

      expect(result).toEqual({ error: '이미 존재하는 아이디입니다.' });
      expect(session.createSession).not.toHaveBeenCalled();
    });

    it('이미 PIN이 있는 계정이면 기존처럼 이미 존재 오류', async () => {
      mockDb.where.mockResolvedValueOnce([{ id: 'u1', username: 'kim.test', pinHash: 'x' }]);

      const result = await signup(null, signupForm());

      expect(result).toEqual({ error: '이미 존재하는 아이디입니다.' });
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginForm = (redirectTo = '/') => {
      const formData = new FormData();
      formData.append('username', 'kim.test');
      formData.append('pin', '1234');
      formData.append('redirect', redirectTo);
      return formData;
    };

    it('로그인 시 DB의 isAdmin/mustChangePin을 세션에 담는다', async () => {
      mockDb.where.mockResolvedValueOnce([{ id: 'u1', username: 'kim.test', pinHash: 'h', isAdmin: true, mustChangePin: false }]);
      vi.mocked(authUtils.verifyPIN).mockResolvedValueOnce(true);
      await login(null, loginForm());
      expect(session.createSession).toHaveBeenCalledWith('u1', 'kim.test', { isAdmin: true, mustChangePin: false });
    });

    it('mustChangePin이면 redirect 값과 무관하게 /change-pin으로 이동', async () => {
      mockDb.where.mockResolvedValueOnce([{ id: 'u1', username: 'kim.test', pinHash: 'h', isAdmin: false, mustChangePin: true }]);
      vi.mocked(authUtils.verifyPIN).mockResolvedValueOnce(true);
      await login(null, loginForm('/mypage'));
      const { redirect } = await import('next/navigation');
      expect(redirect).toHaveBeenLastCalledWith('/change-pin');
    });

    it('pin_hash가 NULL인 미가입 계정은 일반 인증 실패 메시지, verifyPIN 미호출', async () => {
      mockDb.where.mockResolvedValueOnce([{ id: 'u1', username: 'kim.test', pinHash: null }]);
      const formData = new FormData();
      formData.append('username', 'kim.test');
      formData.append('pin', '1234');

      const result = await login(null, formData);

      expect(result).toEqual({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      expect(authUtils.verifyPIN).not.toHaveBeenCalled();
    });

    describe('로그인 성공 후 이동 경로', () => {
      const loginWith = async (redirectTo: string) => {
        mockDb.where.mockResolvedValueOnce([{ id: 'u1', username: 'kim.test', pinHash: 'hash' }]);
        vi.mocked(authUtils.verifyPIN).mockResolvedValueOnce(true);
        const formData = new FormData();
        formData.append('username', 'kim.test');
        formData.append('pin', '1234');
        formData.append('redirect', redirectTo);
        await login(null, formData);
        const { redirect } = await import('next/navigation');
        return vi.mocked(redirect).mock.calls.at(-1)?.[0];
      };

      it('내부 경로면 그 경로로 이동', async () => {
        expect(await loginWith('/mypage')).toBe('/mypage');
      });

      it('외부 URL·프로토콜 상대 경로는 / 로 대체 (오픈 리다이렉트 방지)', async () => {
        expect(await loginWith('https://evil.example')).toBe('/');
        expect(await loginWith('//evil.example')).toBe('/');
        expect(await loginWith('/\\evil.example')).toBe('/');
      });
    });

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

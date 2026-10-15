import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { login, logout, changePin } from './auth';
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

// 해시/검증만 대체하고 PIN 형식 검증(isValidPin)은 실제 구현을 쓴다.
vi.mock('@/lib/auth-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-utils')>()),
  hashPIN: vi.fn(),
  verifyPIN: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('auth server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signup은 더 이상 export되지 않는다 (회원가입 제거)', async () => {
    expect('signup' in (await import('./auth'))).toBe(false);
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

  describe('changePin (초기 PIN 변경 강제)', () => {
    const pinForm = (newPin: string, confirmNewPin = newPin) => {
      const formData = new FormData();
      formData.append('newPin', newPin);
      formData.append('confirmNewPin', confirmNewPin);
      return formData;
    };
    const loggedIn = () => vi.mocked(session.getSession).mockResolvedValueOnce(
      { userId: 'u1', username: 'kim.test', isAdmin: false, mustChangePin: true, expiresAt: new Date() });

    it('비로그인이면 오류', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(null);
      expect(await changePin(null, pinForm('5678'))).toEqual({ error: '로그인이 필요합니다.' });
    });

    it('4자리 숫자가 아니면 오류', async () => {
      loggedIn();
      expect(await changePin(null, pinForm('12a4'))).toEqual({ error: '비밀번호는 4자리 숫자여야 합니다.' });
    });

    it('확인 값이 다르면 오류', async () => {
      loggedIn();
      expect(await changePin(null, pinForm('5678', '5679'))).toEqual({ error: '새 비밀번호가 일치하지 않습니다.' });
    });

    it('현재 PIN과 같으면 거부 (관리자가 지정한 PIN 재사용 방지)', async () => {
      loggedIn();
      mockDb.where.mockResolvedValueOnce([{ id: 'u1', username: 'kim.test', pinHash: 'h', isAdmin: false }]);
      vi.mocked(authUtils.verifyPIN).mockResolvedValueOnce(true);
      expect(await changePin(null, pinForm('5678'))).toEqual({ error: '현재 비밀번호와 다른 비밀번호를 입력해주세요.' });
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('현재 PIN이 초기 PIN이 아니더라도 초기 PIN(1234)으로는 변경 불가', async () => {
      loggedIn();
      expect(await changePin(null, pinForm('1234'))).toEqual({ error: '초기 비밀번호(1234)는 사용할 수 없습니다.' });
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('세션의 사용자가 DB에 없으면 오류', async () => {
      loggedIn();
      mockDb.where.mockResolvedValueOnce([]);
      expect(await changePin(null, pinForm('5678'))).toEqual({ error: '로그인이 필요합니다.' });
    });

    it('성공: PIN 갱신 + mustChangePin=false + 세션 재발급 + / 이동', async () => {
      loggedIn();
      mockDb.where
        .mockResolvedValueOnce([{ id: 'u1', username: 'kim.test', pinHash: 'h', isAdmin: true }])
        .mockResolvedValueOnce(undefined);
      vi.mocked(authUtils.verifyPIN).mockResolvedValueOnce(false);
      vi.mocked(authUtils.hashPIN).mockResolvedValueOnce('hashed');

      await changePin(null, pinForm('5678'));

      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ pinHash: 'hashed', mustChangePin: false }));
      expect(session.createSession).toHaveBeenCalledWith('u1', 'kim.test', { isAdmin: true, mustChangePin: false });
      const { redirect } = await import('next/navigation');
      expect(redirect).toHaveBeenLastCalledWith('/');
    });
  });
});

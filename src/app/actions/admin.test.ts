import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createMember, resetMemberPin } from './admin';
import { db } from '@/db';
import { getAdminUser } from '@/lib/admin';
import * as authUtils from '@/lib/auth-utils';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn() }));
// 해시만 대체하고 PIN 형식 검증·기본 PIN 상수는 실제 구현을 쓴다.
vi.mock('@/lib/auth-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-utils')>()),
  hashPIN: vi.fn().mockResolvedValue('hashed'),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockDb = db as unknown as Record<'select' | 'from' | 'where' | 'insert' | 'values' | 'update' | 'set', Mock>;
const asAdmin = () => vi.mocked(getAdminUser).mockResolvedValueOnce({ id: 'admin', isAdmin: true } as never);
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};
const newMember = (overrides: Record<string, string> = {}) =>
  form({ username: 'new.user', displayName: '신규', department: '개발팀', pin: '', ...overrides });

describe('admin actions', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('권한', () => {
    it('비관리자는 createMember/resetMemberPin 모두 거부, DB 쓰기 없음', async () => {
      vi.mocked(getAdminUser).mockResolvedValue(null);
      expect(await createMember(null, newMember())).toEqual({ error: '권한이 없습니다.' });
      expect(await resetMemberPin(null, form({ userId: 'u2', pin: '' }))).toEqual({ error: '권한이 없습니다.' });
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
      vi.mocked(getAdminUser).mockReset();
    });
  });

  describe('createMember', () => {
    it('필수값 누락 오류', async () => {
      asAdmin();
      expect(await createMember(null, newMember({ displayName: ' ' }))).toEqual({ error: '아이디, 이름, 부서를 모두 입력해주세요.' });
    });

    it('PIN 형식 오류', async () => {
      asAdmin();
      expect(await createMember(null, newMember({ pin: '12a4' }))).toEqual({ error: '비밀번호는 4자리 숫자여야 합니다.' });
    });

    it('중복 아이디 오류', async () => {
      asAdmin();
      mockDb.where.mockResolvedValueOnce([{ id: 'u9', username: 'new.user', nickname: 'x' }]);
      expect(await createMember(null, newMember())).toEqual({ error: '이미 존재하는 아이디입니다.' });
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('아이디 앞뒤 공백을 제거하고, PIN을 비우면 1234 + mustChangePin=true로 생성', async () => {
      asAdmin();
      mockDb.where.mockResolvedValueOnce([]);
      const result = await createMember(null, newMember({ username: '  new.user ' }));
      expect(result).toEqual({ success: 'new.user 회원을 생성했습니다.' });
      expect(authUtils.hashPIN).toHaveBeenCalledWith('1234');
      expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
        username: 'new.user', displayName: '신규', department: '개발팀', pinHash: 'hashed', mustChangePin: true,
      }));
    });

    it('닉네임 최초값은 아이디로 함께 저장한다', async () => {
      asAdmin();
      mockDb.where.mockResolvedValueOnce([]);
      await createMember(null, newMember());
      expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ username: 'new.user', nickname: 'new.user' }));
    });

    it('닉네임(20자)에 담을 수 없는 20자 초과 아이디는 거부한다', async () => {
      asAdmin();
      expect(await createMember(null, newMember({ username: 'a'.repeat(21) }))).toEqual({ error: '아이디는 20자 이하여야 합니다.' });
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('아이디가 다른 회원의 닉네임과 (대소문자 무시) 겹치면 거부한다', async () => {
      asAdmin();
      mockDb.where.mockResolvedValueOnce([{ id: 'u3', username: 'someone', nickname: 'New.User' }]);
      expect(await createMember(null, newMember())).toEqual({ error: '이미 사용 중인 닉네임과 같은 아이디입니다.' });
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('사전 조회 뒤 동시에 같은 닉네임이 생겨 고유 인덱스(23505)에 걸려도 같은 오류로 돌려준다', async () => {
      asAdmin();
      mockDb.where.mockResolvedValueOnce([]);
      mockDb.values.mockRejectedValueOnce(Object.assign(new Error('Failed query'), { cause: { code: '23505' } }));
      expect(await createMember(null, newMember())).toEqual({ error: '이미 존재하는 아이디 또는 닉네임입니다.' });
    });
  });

  describe('resetMemberPin', () => {
    it('대상이 없으면 오류', async () => {
      asAdmin();
      mockDb.where.mockResolvedValueOnce([]);
      expect(await resetMemberPin(null, form({ userId: 'nope', pin: '' }))).toEqual({ error: '회원을 찾을 수 없습니다.' });
    });

    it('PIN 형식 오류', async () => {
      asAdmin();
      expect(await resetMemberPin(null, form({ userId: 'u2', pin: '99' }))).toEqual({ error: '비밀번호는 4자리 숫자여야 합니다.' });
    });

    it('지정 PIN으로 갱신하고 mustChangePin=true', async () => {
      asAdmin();
      mockDb.where.mockResolvedValueOnce([{ id: 'u2', username: 'kim.test' }]).mockResolvedValueOnce(undefined);
      const result = await resetMemberPin(null, form({ userId: 'u2', pin: '4321' }));
      expect(result).toEqual({ success: 'kim.test 회원의 비밀번호를 초기화했습니다.' });
      expect(authUtils.hashPIN).toHaveBeenCalledWith('4321');
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ pinHash: 'hashed', mustChangePin: true }));
    });
  });
});

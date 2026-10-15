import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { updateProfile } from './mypage';
import * as session from '@/lib/session';

vi.mock('@/db', () => ({
  db: {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn(),
  },
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('mypage server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateProfile', () => {
    it('returns error if not logged in', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(null);
      const formData = new FormData();
      const result = await updateProfile(null, formData);
      expect(result).toEqual({ error: '로그인이 필요합니다.' });
    });

    it('returns error if new PINs do not match', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: '1', username: 'test' });
      const formData = new FormData();
      formData.append('newPin', '1234');
      formData.append('confirmNewPin', '4321');
      const result = await updateProfile(null, formData);
      expect(result).toEqual({ error: '새 비밀번호가 일치하지 않습니다.' });
    });

    it('returns error if new PIN is invalid format', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: '1', username: 'test' });
      const formData = new FormData();
      formData.append('newPin', '123');
      formData.append('confirmNewPin', '123');
      const result = await updateProfile(null, formData);
      expect(result).toEqual({ error: '비밀번호는 4자리 숫자여야 합니다.' });
    });
  
    it('마이페이지에서도 초기 PIN(1234)으로는 변경 불가', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: '1', username: 'test', isAdmin: false, mustChangePin: false, expiresAt: new Date() });
      const formData = new FormData();
      formData.append('newPin', '1234');
      formData.append('confirmNewPin', '1234');
      expect(await updateProfile(null, formData)).toEqual({ error: '초기 비밀번호(1234)는 사용할 수 없습니다.' });
    });

    it('PIN을 바꾸면 mustChangePin=false로 저장하고 세션 재발급(관리자 여부는 DB 값)', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: '1', username: 'test', isAdmin: false, mustChangePin: true, expiresAt: new Date() });
      const { db } = await import('@/db');
      const mockDb = db as unknown as Record<'update' | 'set' | 'where', Mock>;
      mockDb.where.mockReturnValueOnce({ returning: vi.fn().mockResolvedValue([{ isAdmin: true }]) });
      const formData = new FormData();
      formData.append('newPin', '5678');
      formData.append('confirmNewPin', '5678');

      expect(await updateProfile(null, formData)).toEqual({ success: '정보가 성공적으로 수정되었습니다.' });
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ mustChangePin: false, pinHash: expect.any(String) }));
      expect(session.createSession).toHaveBeenCalledWith('1', 'test', { isAdmin: true, mustChangePin: false });
    });
  });
});

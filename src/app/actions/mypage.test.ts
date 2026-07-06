import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  });
});

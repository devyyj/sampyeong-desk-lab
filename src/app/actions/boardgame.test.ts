import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addBoardGame } from './boardgame';
import * as session from '@/lib/session';

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('boardgame server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addBoardGame', () => {
    it('returns error if not logged in', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(null);
      const formData = new FormData();
      const result = await addBoardGame(null, formData);
      expect(result).toEqual({ error: '로그인이 필요합니다.' });
    });

    it('returns error if name is missing', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: '1', username: 'test' });
      const formData = new FormData();
      const result = await addBoardGame(null, formData);
      expect(result).toEqual({ error: '보드게임 이름을 입력해주세요.' });
    });
  });
});

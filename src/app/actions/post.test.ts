import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPost, updatePost, deletePost } from './post';
import * as session from '@/lib/session';

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
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

describe('post server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPost', () => {
    it('returns error if not logged in', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(null);
      const formData = new FormData();
      const result = await createPost(null, formData);
      expect(result).toEqual({ error: '로그인이 필요합니다.' });
    });

    it('returns error if content is missing', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: '1', username: 'test' });
      const formData = new FormData();
      const result = await createPost(null, formData);
      expect(result).toEqual({ error: '내용을 입력해주세요.' });
    });
  });

  describe('updatePost', () => {
    it('returns error if not logged in', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(null);
      const formData = new FormData();
      const result = await updatePost(formData);
      expect(result).toEqual({ error: '로그인이 필요합니다.' });
    });
  });

  describe('deletePost', () => {
    it('throws error if not logged in', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(null);
      await expect(deletePost('1')).rejects.toThrow('로그인이 필요합니다.');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getPostView, type FeedItem } from '@/lib/feed';
import PostDetailPage from './page';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/feed', () => ({ getPostView: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/app/actions/profile', () => ({ getProfile: vi.fn() }));
vi.mock('@/app/actions/comments', () => ({ addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn() }));
vi.mock('@/app/actions/reactions', () => ({ setLike: vi.fn() }));
vi.mock('@/app/actions/post', () => ({ deletePost: vi.fn() }));

const ID = '0b5c9a52-6f1e-4c55-9d8e-0d1f6c2a7b11';
const item: FeedItem = {
  id: ID, authorId: 'u1', author: { id: 'u1', nickname: '반갑읍니다', profileImageUrl: null }, badge: { kind: 'president' },
  content: '• 인원 : 8명', createdAt: '2026-03-10T03:00:00.000Z', createdLabel: '3월 10일',
  seasonName: '시즌 2', meetingDate: null, meetingDateLabel: null, tags: ['정기 모임'],
  images: [], photoCount: 2, photosLocked: true, likeCount: 1, liked: false, comments: [], canEdit: false,
};
const page = async (id = ID) => render(await PostDetailPage({ params: Promise.resolve({ id }) }));

describe('게시글 상세 /posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(getPostView).mockResolvedValue(item);
  });

  it('형식이 잘못된 id는 조회하지 않고 404', async () => {
    await expect(page('not-a-uuid')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getPostView).not.toHaveBeenCalled();
    expect(notFound).toHaveBeenCalled();
  });

  it('없는 글은 404', async () => {
    vi.mocked(getPostView).mockResolvedValueOnce(null);
    await expect(page()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('본문 전체·태그·잠긴 사진 안내(로그인 후 이 글로 돌아옴)·댓글 펼침', async () => {
    await page();
    expect(getPostView).toHaveBeenCalledWith(ID, null);
    expect(screen.getByRole('heading', { level: 1, name: '게시글' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '#정기 모임' })).toBeInTheDocument();
    expect(screen.getByText('로그인하면 사진 2장을 볼 수 있어요')).toBeInTheDocument();
    // 잠긴 사진·댓글의 로그인 링크 모두 로그인 후 이 글로 돌아온다.
    for (const link of screen.getAllByRole('link', { name: /로그인/ })) {
      expect(link).toHaveAttribute('href', `/login?redirect=${encodeURIComponent(`/posts/${ID}`)}`);
    }
    expect(screen.getByRole('heading', { name: '댓글 0' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '피드로 돌아가기' })).toHaveAttribute('href', '/');
  });

  it('회원이면 세션으로 조회한다', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'v', username: 'v', isAdmin: false, mustChangePin: false, expiresAt: new Date() });
    await page();
    expect(getPostView).toHaveBeenCalledWith(ID, { id: 'v', isAdmin: false });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getSession } from '@/lib/session';
import { getFeedPage, type FeedItem } from '@/lib/feed';
import Page from './page';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/feed', () => ({ getFeedPage: vi.fn() }));
vi.mock('@/app/actions/feed', () => ({ loadMoreFeed: vi.fn(), loadFeedItem: vi.fn() }));
vi.mock('@/app/actions/profile', () => ({ getProfile: vi.fn() }));
vi.mock('@/app/actions/comments', () => ({ addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn() }));
vi.mock('@/app/actions/reactions', () => ({ toggleLike: vi.fn() }));
vi.mock('@/app/actions/post', () => ({ deletePost: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const item: FeedItem = {
  id: 'p1', authorId: 'u1', author: { id: 'u1', nickname: '보드왕', profileImageUrl: null }, badge: null,
  content: '오늘 재밌었어요', createdAt: '2026-10-17T00:00:00.000Z', createdLabel: '방금', seasonName: null, tags: [],
  images: [], photoCount: 0, photosLocked: false, likeCount: 0, liked: false, comments: [], canEdit: false,
};
const render$ = async (params: Record<string, string> = {}) => render(await Page({ searchParams: Promise.resolve(params) }));

describe('피드 페이지', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(getFeedPage).mockResolvedValue({ items: [item], hasMore: false });
  });

  it('필터 칩 없이 최신순 첫 페이지를 그린다(비회원은 viewer 없이)', async () => {
    await render$();
    expect(getFeedPage).toHaveBeenCalledWith({ tag: null }, 0, null);
    expect(screen.getByRole('heading', { level: 1, name: '피드' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '글 종류' })).toBeNull();
    expect(screen.getByRole('article')).toHaveTextContent('오늘 재밌었어요');
  });

  it('회원이면 세션으로 viewer를 만든다', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'v', username: 'v', isAdmin: true, mustChangePin: false, expiresAt: new Date() });
    await render$();
    expect(getFeedPage).toHaveBeenCalledWith({ tag: null }, 0, { id: 'v', isAdmin: true });
  });

  it('?tag= 이면 그 태그 글만 모아 보고, 제목 줄에 태그와 전체 보기 링크', async () => {
    await render$({ tag: '방탈출' });
    expect(getFeedPage).toHaveBeenCalledWith({ tag: '방탈출' }, 0, null);
    expect(screen.getByRole('heading', { level: 1, name: '#방탈출' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '전체 보기' })).toHaveAttribute('href', '/');
  });

  it('예전 주소의 ?kind= 는 무시하고 전체를 보여준다', async () => {
    await render$({ kind: 'activity' });
    expect(getFeedPage).toHaveBeenCalledWith({ tag: null }, 0, null);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { getSession } from '@/lib/session';
import { getActivityTypes, getFeedPage, type FeedItem } from '@/lib/feed';
import Page from './page';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/feed', () => ({ getFeedPage: vi.fn(), getActivityTypes: vi.fn() }));
vi.mock('@/app/actions/feed', () => ({ loadMoreFeed: vi.fn() }));
vi.mock('@/app/actions/profile', () => ({ getProfile: vi.fn() }));
vi.mock('@/app/actions/comments', () => ({ addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn() }));
vi.mock('@/app/actions/reactions', () => ({ toggleLike: vi.fn() }));
vi.mock('@/app/actions/post', () => ({ deletePost: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const item: FeedItem = {
  id: 'p1', authorId: 'u1', author: { id: 'u1', nickname: '보드왕', profileImageUrl: null }, badge: null,
  content: '오늘 재밌었어요', createdAt: '2026-10-17T00:00:00.000Z', createdLabel: '방금', activity: null,
  images: [], photoCount: 0, photosLocked: false, likeCount: 0, liked: false, comments: [], canEdit: false,
};
const render$ = async (params: Record<string, string> = {}) => render(await Page({ searchParams: Promise.resolve(params) }));

describe('통합 피드 페이지', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(getFeedPage).mockResolvedValue({ items: [item], hasMore: false });
    vi.mocked(getActivityTypes).mockResolvedValue(['방탈출', '정기 모임', '보드게임 카페']);
  });

  it('주소의 필터로 첫 페이지를 그린다(비회원은 viewer 없이)', async () => {
    await render$({ kind: 'activity', type: '점심' });
    expect(getFeedPage).toHaveBeenCalledWith({ kind: 'activity', type: '점심' }, 0, null);
    expect(screen.getByRole('article')).toHaveTextContent('오늘 재밌었어요');
  });

  it('회원이면 세션으로 viewer를 만든다', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'v', username: 'v', isAdmin: true, mustChangePin: false, expiresAt: new Date() });
    await render$();
    expect(getFeedPage).toHaveBeenCalledWith({ kind: 'all', type: null }, 0, { id: 'v', isAdmin: true });
  });

  it('필터 칩: 전체·활동 기록·자유글, 지금 필터에 aria-current', async () => {
    await render$();
    const nav = screen.getByRole('navigation', { name: '글 종류' });
    expect(within(nav).getByRole('link', { name: '전체' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: '활동 기록' })).toHaveAttribute('href', '/?kind=activity');
    expect(within(nav).getByRole('link', { name: '자유글' })).toHaveAttribute('href', '/?kind=general');
    // 활동 기록을 고르기 전에는 종류 칩이 없고, 종류를 세지도 않는다.
    expect(screen.queryByRole('navigation', { name: '활동 종류' })).toBeNull();
    expect(getActivityTypes).not.toHaveBeenCalled();
  });

  it('활동 기록을 고르면 실제로 쓰인 종류(많이 쓴 순)로 칩이 나온다', async () => {
    await render$({ kind: 'activity', type: '방탈출' });
    const types = screen.getByRole('navigation', { name: '활동 종류' });
    expect(within(types).getAllByRole('link').map((a) => a.textContent)).toEqual(['모든 종류', '방탈출', '정기 모임', '보드게임 카페']);
    expect(within(types).getByRole('link', { name: '방탈출' })).toHaveAttribute('aria-current', 'page');
    expect(within(types).getByRole('link', { name: '모든 종류' })).toHaveAttribute('href', '/?kind=activity');
  });

  it('주소의 종류가 목록에 없어도(오래된 링크) 지금 고른 칩을 보여준다', async () => {
    await render$({ kind: 'activity', type: '번개' });
    expect(screen.getByRole('navigation', { name: '활동 종류' }).querySelector('[aria-current="page"]')).toHaveTextContent('번개');
  });
});

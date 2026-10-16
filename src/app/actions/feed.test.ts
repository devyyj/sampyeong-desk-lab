import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFeedPage, getPostView } from '@/lib/feed';
import { getSession } from '@/lib/session';
import { loadFeedItem, loadMoreFeed } from './feed';

vi.mock('@/lib/feed', () => ({ getFeedPage: vi.fn(), getPostView: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));

const EMPTY = { items: [], hasMore: false };

describe('loadMoreFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFeedPage).mockResolvedValue(EMPTY);
  });

  it('비회원도 다음 페이지를 받는다(피드는 공개). 활동 사진 공개 여부는 세션으로 정해진다', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect(await loadMoreFeed({ tag: '점심' }, 10)).toEqual(EMPTY);
    expect(getFeedPage).toHaveBeenCalledWith({ tag: '점심' }, 10, null);
  });

  it('회원이면 세션의 회원으로 조회한다(클라이언트가 보낸 값이 아니라)', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1', username: 'u', isAdmin: true, mustChangePin: false, expiresAt: new Date() });
    await loadMoreFeed({ tag: null }, 0);
    expect(getFeedPage).toHaveBeenCalledWith({ tag: null }, 0, { id: 'u1', isAdmin: true });
  });

  it('태그 필터는 서버에서 다시 정리·검사한다(잘못된 태그는 전체로)', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await loadMoreFeed({ tag: '가'.repeat(30) }, 0);
    expect(getFeedPage).toHaveBeenCalledWith({ tag: null }, 0, null);
    await loadMoreFeed({ tag: ' #방탈출 ' }, 0);
    expect(getFeedPage).toHaveBeenLastCalledWith({ tag: '방탈출' }, 0, null);
  });

  it('offset이 0 이상의 정수가 아니면 조회하지 않는다', async () => {
    for (const bad of [-1, 1.5, NaN, '20', null, 1e9]) {
      expect(await loadMoreFeed({ tag: null }, bad as never)).toEqual(EMPTY);
    }
    expect(getFeedPage).not.toHaveBeenCalled();
  });
});

describe('loadFeedItem', () => {
  const ID = '0b5c9a52-6f1e-4c55-9d8e-0d1f6c2a7b11';
  beforeEach(() => vi.clearAllMocks());

  it('세션의 회원 기준으로 카드 한 장을 다시 받는다', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1', username: 'u', isAdmin: false, mustChangePin: false, expiresAt: new Date() });
    vi.mocked(getPostView).mockResolvedValue(null);
    expect(await loadFeedItem(ID)).toBeNull();
    expect(getPostView).toHaveBeenCalledWith(ID, { id: 'u1', isAdmin: false });
  });

  it('id 형식이 아니면 조회하지 않는다', async () => {
    expect(await loadFeedItem('nope')).toBeNull();
    expect(getPostView).not.toHaveBeenCalled();
  });
});

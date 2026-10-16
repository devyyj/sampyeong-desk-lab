import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFeedPage } from '@/lib/feed';
import { getSession } from '@/lib/session';
import { loadMoreFeed } from './feed';

vi.mock('@/lib/feed', () => ({ getFeedPage: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));

const EMPTY = { items: [], hasMore: false };

describe('loadMoreFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFeedPage).mockResolvedValue(EMPTY);
  });

  it('비회원도 다음 페이지를 받는다(피드는 공개). 활동 사진 공개 여부는 세션으로 정해진다', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect(await loadMoreFeed({ kind: 'activity', type: 'LUNCH' }, 10)).toEqual(EMPTY);
    expect(getFeedPage).toHaveBeenCalledWith({ kind: 'activity', type: 'LUNCH' }, 10, null);
  });

  it('회원이면 세션의 회원으로 조회한다(클라이언트가 보낸 값이 아니라)', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1', username: 'u', isAdmin: true, mustChangePin: false, expiresAt: new Date() });
    await loadMoreFeed({ kind: 'all', type: null }, 0);
    expect(getFeedPage).toHaveBeenCalledWith({ kind: 'all', type: null }, 0, { id: 'u1', isAdmin: true });
  });

  it('필터는 서버에서 다시 검사한다(모르는 값은 기본값으로)', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await loadMoreFeed({ kind: 'activity', type: 'DROP TABLE' } as never, 0);
    expect(getFeedPage).toHaveBeenCalledWith({ kind: 'activity', type: null }, 0, null);
  });

  it('offset이 0 이상의 정수가 아니면 조회하지 않는다', async () => {
    for (const bad of [-1, 1.5, NaN, '20', null, 1e9]) {
      expect(await loadMoreFeed({ kind: 'all', type: null }, bad as never)).toEqual(EMPTY);
    }
    expect(getFeedPage).not.toHaveBeenCalled();
  });
});

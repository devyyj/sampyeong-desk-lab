import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActivityPage } from '@/lib/activity-list';
import { loadMoreActivities } from './activities';

vi.mock('@/lib/activity-list', () => ({ getActivityPage: vi.fn() }));

describe('loadMoreActivities', () => {
  beforeEach(() => vi.clearAllMocks());

  it('비회원도 다음 페이지를 받을 수 있다(활동 기록은 공개 페이지)', async () => {
    vi.mocked(getActivityPage).mockResolvedValueOnce({ items: [], hasMore: false });
    expect(await loadMoreActivities(20)).toEqual({ items: [], hasMore: false });
    expect(getActivityPage).toHaveBeenCalledWith(20);
  });

  it('offset이 0 이상의 정수가 아니면 조회하지 않는다', async () => {
    for (const bad of [-1, 1.5, NaN, '20', null, 1e9]) {
      expect(await loadMoreActivities(bad as never)).toEqual({ items: [], hasMore: false });
    }
    expect(getActivityPage).not.toHaveBeenCalled();
  });
});

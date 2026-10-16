import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/db';
import { getCommentCounts, getLikeSummaries } from './community';
import { ACTIVITY_PAGE_SIZE, getActivityPage, getActivityStats } from './activity-list';

const groupBy = vi.fn();
vi.mock('@/db', () => ({
  db: {
    query: { activities: { findMany: vi.fn() } },
    select: vi.fn(() => ({ from: () => ({ groupBy }) })),
  },
}));
vi.mock('./community', () => ({ getLikeSummaries: vi.fn(), getCommentCounts: vi.fn() }));

const row = (id: string, seasonId: number) => ({ id, seasonId, date: '2026-03-10', type: 'LUNCH', title: `활동 ${id}`, photos: [{ id: 'p' }] });

describe('getActivityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLikeSummaries).mockResolvedValue(new Map([['a1', { count: 3, liked: false }]]));
    vi.mocked(getCommentCounts).mockResolvedValue(new Map([['a1', 2]]));
  });

  it('시즌 최신순으로 한 페이지를 가져오고(다음 페이지 확인용 1개 더), 좋아요·댓글·사진 수를 붙인다', async () => {
    vi.mocked(db.query.activities.findMany).mockResolvedValueOnce([row('a1', 3), row('a2', 3)] as never);
    const page = await getActivityPage(40);
    const query = vi.mocked(db.query.activities.findMany).mock.calls[0][0]!;
    expect(query).toMatchObject({ limit: ACTIVITY_PAGE_SIZE + 1, offset: 40 });
    expect(page).toEqual({
      hasMore: false,
      items: [
        { id: 'a1', seasonId: 3, date: '2026-03-10', type: 'LUNCH', title: '활동 a1', photoCount: 1, likeCount: 3, commentCount: 2 },
        { id: 'a2', seasonId: 3, date: '2026-03-10', type: 'LUNCH', title: '활동 a2', photoCount: 1, likeCount: 0, commentCount: 0 },
      ],
    });
    // 목록에서는 내가 눌렀는지 표시하지 않으므로 viewer 없이 센다.
    expect(getLikeSummaries).toHaveBeenCalledWith('activity', ['a1', 'a2'], null);
  });

  it('한 페이지보다 많으면 hasMore이고, 넘친 1개는 돌려주지 않는다', async () => {
    const rows = Array.from({ length: ACTIVITY_PAGE_SIZE + 1 }, (_, i) => row(`a${i}`, 1));
    vi.mocked(db.query.activities.findMany).mockResolvedValueOnce(rows as never);
    const page = await getActivityPage(0);
    expect(page.hasMore).toBe(true);
    expect(page.items).toHaveLength(ACTIVITY_PAGE_SIZE);
    expect(getLikeSummaries).toHaveBeenCalledWith('activity', rows.slice(0, ACTIVITY_PAGE_SIZE).map((r) => r.id), null);
  });
});

describe('getActivityStats', () => {
  it('전체 수, 시즌별 수, 종류별 수(많은 순, 같은 화면 이름끼리 합침)를 한 번의 쿼리로 센다', async () => {
    groupBy.mockResolvedValueOnce([
      { seasonId: 2, type: 'LUNCH', count: 3 },
      { seasonId: 1, type: 'LUNCH', count: 1 },
      { seasonId: 1, type: 'ESCAPE_ROOM', count: 2 },
      // 모르는 종류는 '기타'로 합쳐진다.
      { seasonId: 2, type: 'UNKNOWN', count: 1 },
    ]);
    const stats = await getActivityStats();
    expect(stats.total).toBe(7);
    expect(stats.bySeason).toEqual({ 1: 3, 2: 4 });
    expect(stats.byType).toEqual([['점심', 4], ['방탈출', 2], ['기타', 1]]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});

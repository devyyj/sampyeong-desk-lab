import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/db';
import { getMemberBadges } from './member-badges';
import { getComments, getLikeSummaries, getCommentCounts, formatKst } from './community';

const groupBy = vi.fn();
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ groupBy }) }) })),
    query: { comments: { findMany: vi.fn() } },
  },
}));
vi.mock('./member-badges', () => ({ getMemberBadges: vi.fn() }));

const P1 = 'p1';
const A = 'author-a';

describe('getLikeSummaries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('대상이 없으면 조회하지 않는다', async () => {
    expect((await getLikeSummaries('post', [], 'me')).size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('대상별 개수와 내가 눌렀는지를 한 번에 돌려주고, 없는 대상은 0/false', async () => {
    groupBy.mockResolvedValueOnce([{ targetId: 'x', count: 2, liked: true }]);
    const map = await getLikeSummaries('post', ['x', 'y'], 'me');
    expect(map.get('x')).toEqual({ count: 2, liked: true });
    expect(map.get('y')).toEqual({ count: 0, liked: false });
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('비회원은 liked가 항상 false', async () => {
    groupBy.mockResolvedValueOnce([{ targetId: 'x', count: 2, liked: null }]);
    expect((await getLikeSummaries('activity', ['x'], null)).get('x')).toEqual({ count: 2, liked: false });
  });
});

describe('getCommentCounts', () => {
  it('대상별 댓글 수, 없으면 0', async () => {
    groupBy.mockResolvedValueOnce([{ targetId: 'x', count: 4 }]);
    const map = await getCommentCounts('activity', ['x', 'y']);
    expect(map.get('x')).toBe(4);
    expect(map.get('y')).toBe(0);
  });
});

describe('getComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMemberBadges).mockResolvedValue(new Map([[A, { kind: 'seasons' as const, count: 2 }]]));
  });

  it('대상별로 오래된 순 댓글을 묶고, 작성자 닉네임·배지·좋아요·수정 여부를 붙인다', async () => {
    const created = new Date('2026-10-16T03:04:00Z');
    vi.mocked(db.query.comments.findMany).mockResolvedValueOnce([
      { id: 'c1', postId: P1, activityId: null, authorId: A, content: '첫 댓글', createdAt: created, updatedAt: created, author: { id: A, nickname: '보드왕' } },
      {
        id: 'c2', postId: P1, activityId: null, authorId: 'b', content: '고침', createdAt: created,
        // 작성 직후(1초 안)에 고쳐도 수정됨으로 본다.
        updatedAt: new Date(created.getTime() + 300), author: { id: 'b', nickname: '둘째' },
      },
    ] as never);
    groupBy.mockResolvedValueOnce([{ targetId: 'c2', count: 1, liked: true }]);

    const map = await getComments('post', [P1, 'p2'], 'me');
    expect(map.get('p2')).toEqual([]);
    expect(map.get(P1)).toEqual([
      { id: 'c1', authorId: A, nickname: '보드왕', badge: { kind: 'seasons', count: 2 }, content: '첫 댓글', createdLabel: '2026. 10. 16. 12:04', edited: false, likeCount: 0, liked: false },
      { id: 'c2', authorId: 'b', nickname: '둘째', badge: null, content: '고침', createdLabel: '2026. 10. 16. 12:04', edited: true, likeCount: 1, liked: true },
    ]);
    // 배지는 작성자 전체를 한 번에 계산한다.
    expect(getMemberBadges).toHaveBeenCalledWith([A, 'b']);
  });

  it('대상이 없으면 조회하지 않는다', async () => {
    expect((await getComments('activity', [], null)).size).toBe(0);
    expect(db.query.comments.findMany).not.toHaveBeenCalled();
  });
});

describe('formatKst', () => {
  it('서버 시간대와 관계없이 한국 시간으로 표시한다(서버·브라우저 렌더 결과가 같도록)', () => {
    expect(formatKst(new Date('2026-12-31T15:30:00Z'))).toBe('2027. 01. 01. 00:30');
  });
});

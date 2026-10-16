import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/db';
import { getMemberBadges, getSeasonCounts } from './member-badges';
import { badgeLabel } from './badge';

const groupBy = vi.fn();
vi.mock('@/db', () => ({ db: { select: vi.fn() } }));

describe('getMemberBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where: () => ({ groupBy }) }) } as never);
  });

  it('회원이 없으면 DB를 조회하지 않는다', async () => {
    expect((await getMemberBadges([])).size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('최신 시즌 회장은 회장 배지, 그 외는 참여 시즌 수, 기록이 없으면 배지 없음', async () => {
    groupBy.mockResolvedValueOnce([
      { userId: 'pres', seasonCount: 3, isCurrentPresident: true },
      // 예전 시즌에만 회장이었다면 숫자 배지
      { userId: 'old-pres', seasonCount: 2, isCurrentPresident: false },
      { userId: 'one', seasonCount: 1, isCurrentPresident: false },
    ]);
    const badges = await getMemberBadges(['pres', 'old-pres', 'one', 'none', 'one']);
    expect(badges.get('pres')).toEqual({ kind: 'president' });
    expect(badges.get('old-pres')).toEqual({ kind: 'seasons', count: 2 });
    expect(badges.get('one')).toEqual({ kind: 'seasons', count: 1 });
    expect(badges.has('none')).toBe(false);
    // 같은 회원이 여러 번 와도 한 번의 쿼리로 처리한다(N+1 방지).
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});

describe('getSeasonCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where: () => ({ groupBy }) }) } as never);
  });

  it('회장 여부와 관계없이 참여 시즌 수를 돌려주고, 기록이 없으면 0(회원 명부는 그 시즌의 직책을 따로 표시)', async () => {
    groupBy.mockResolvedValueOnce([{ userId: 'pres', seasonCount: 3, isCurrentPresident: true }]);
    const counts = await getSeasonCounts(['pres', 'none']);
    expect(counts.get('pres')).toBe(3);
    expect(counts.get('none')).toBe(0);
  });

  it('회원이 없으면 DB를 조회하지 않는다', async () => {
    expect((await getSeasonCounts([])).size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe('badgeLabel', () => {
  it('레벨 시스템: 참여 시즌 수 N → Lv.N, 회장은 무조건 회장', () => {
    expect(badgeLabel({ kind: 'president' })).toBe('회장');
    expect(badgeLabel({ kind: 'seasons', count: 1 })).toBe('Lv.1');
    expect(badgeLabel({ kind: 'seasons', count: 5 })).toBe('Lv.5');
  });
});

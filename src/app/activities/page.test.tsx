import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '@/db';
import { getActivityPage, getActivityStats } from '@/lib/activity-list';
import ActivitiesPage from './page';

vi.mock('@/db', () => ({ db: { query: { seasons: { findMany: vi.fn() } } } }));
vi.mock('@/lib/activity-list', () => ({ getActivityPage: vi.fn(), getActivityStats: vi.fn() }));
// 목록 자체(묶음·무한 스크롤)는 ActivityFeed 테스트에서 본다. 여기서는 넘기는 값만 확인한다.
const feedProps = vi.fn();
vi.mock('@/components/ActivityFeed', () => ({
  default: (props: unknown) => {
    feedProps(props);
    return null;
  },
}));

const seasons = [
  { id: 1, name: '시즌 1', period: '25년 4분기' },
  { id: 2, name: '시즌 2', period: '26년 1분기' },
];
const firstPage = { items: [{ id: 'a1' }], hasMore: true };

describe('ActivitiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.query.seasons.findMany).mockResolvedValue(seasons as never);
    vi.mocked(getActivityPage).mockResolvedValue(firstPage as never);
    vi.mocked(getActivityStats).mockResolvedValue({ total: 7, bySeason: { 2: 7 }, byType: [['점심', 4], ['방탈출', 3]] });
  });

  it('시즌 선택 없이 첫 페이지와 시즌 정보(시즌별 전체 건수)를 목록에 넘긴다', async () => {
    render(await ActivitiesPage());
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(getActivityPage).toHaveBeenCalledWith(0);
    expect(feedProps).toHaveBeenCalledWith({
      initial: firstPage,
      seasons: [
        { id: 1, name: '시즌 1', period: '25년 4분기', count: 0 },
        { id: 2, name: '시즌 2', period: '26년 1분기', count: 7 },
      ],
    });
  });

  it('머리말에 전체 활동 수와 종류별 수', async () => {
    render(await ActivitiesPage());
    expect(screen.getByText('활동 7건')).toBeInTheDocument();
    expect(screen.getByText('점심 4')).toBeInTheDocument();
    expect(screen.getByText('방탈출 3')).toBeInTheDocument();
  });

  it('시즌이 하나도 없으면 활동을 조회하지 않고 안내', async () => {
    vi.mocked(db.query.seasons.findMany).mockResolvedValueOnce([] as never);
    render(await ActivitiesPage());
    expect(getActivityPage).not.toHaveBeenCalled();
    expect(screen.getByText('등록된 시즌이 없습니다.')).toBeInTheDocument();
  });
});

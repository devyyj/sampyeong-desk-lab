import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '@/db';
import ActivitiesPage from './page';

vi.mock('@/db', () => ({
  db: { query: { seasons: { findMany: vi.fn() }, activities: { findMany: vi.fn() } } },
}));

const seasons = [
  { id: 1, name: '시즌 1', period: '25년 4분기' },
  { id: 2, name: '시즌 2', period: '26년 1분기' },
];

const page = async (season?: string) => render(await ActivitiesPage({ searchParams: Promise.resolve({ season }) }));

describe('ActivitiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.query.seasons.findMany).mockResolvedValue(seasons as never);
    vi.mocked(db.query.activities.findMany).mockResolvedValue([
      { id: 'a2', date: '2026-03-10', type: 'LUNCH', title: '점심 보드게임', photos: [{ id: 'p1' }, { id: 'p2' }] },
      { id: 'a1', date: '2026-02-01', type: 'ESCAPE_ROOM', title: '방탈출 원정', photos: [] },
    ] as never);
  });

  it('시즌을 지정하지 않으면 최근 시즌을 보여주고, 활동을 상세 링크로 나열', async () => {
    await page();
    expect(screen.getByRole('heading', { name: '시즌 2 · 26년 1분기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /점심 보드게임/ })).toHaveAttribute('href', '/activities/a2');
    expect(screen.getByRole('link', { name: /방탈출 원정/ })).toHaveAttribute('href', '/activities/a1');
  });

  it('종류 배지, 날짜, 사진 수(있을 때만)를 표시', async () => {
    await page();
    const row = screen.getByRole('link', { name: /점심 보드게임/ });
    expect(row).toHaveTextContent('점심');
    expect(row).toHaveTextContent('2026-03-10');
    expect(row).toHaveTextContent('📷 2');
    expect(screen.getByRole('link', { name: /방탈출 원정/ })).not.toHaveTextContent('📷');
  });

  it('시즌 요약: 전체 활동 수와 종류별 수', async () => {
    await page();
    expect(screen.getByText('활동 2건')).toBeInTheDocument();
    expect(screen.getByText('점심 1')).toBeInTheDocument();
    expect(screen.getByText('방탈출 1')).toBeInTheDocument();
  });

  it('?season=1 이면 시즌 1을 보여준다', async () => {
    await page('1');
    expect(screen.getByRole('heading', { name: '시즌 1 · 25년 4분기' })).toBeInTheDocument();
  });

  it('활동이 없으면 안내 문구', async () => {
    vi.mocked(db.query.activities.findMany).mockResolvedValueOnce([] as never);
    await page();
    expect(screen.getByText('이 시즌에 기록된 활동이 없습니다.')).toBeInTheDocument();
  });

  it('시즌이 하나도 없으면 활동을 조회하지 않고 안내', async () => {
    vi.mocked(db.query.seasons.findMany).mockResolvedValueOnce([] as never);
    await page();
    expect(db.query.activities.findMany).not.toHaveBeenCalled();
    expect(screen.getByText('등록된 시즌이 없습니다.')).toBeInTheDocument();
  });
});

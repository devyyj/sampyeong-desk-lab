import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '@/db';
import { getSession } from '@/lib/session';
import BoardGamesPage from './page';

vi.mock('@/db', () => ({ db: { query: { boardGames: { findMany: vi.fn() } } } }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/components/DeleteBoardGameButton', () => ({ default: () => null }));

const game = (o: Record<string, unknown>) => ({
  id: o.name, status: 'AVAILABLE', thumbnailUrl: null, recommendedPlayers: null, playTime: null,
  category: null, inSharedCabinet: false, owner: null, ...o,
});

const page = async (sp: Record<string, string> = {}) => render(await BoardGamesPage({ searchParams: Promise.resolve(sp) }));
const titles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

describe('BoardGamesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(db.query.boardGames.findMany).mockResolvedValue([
      game({ name: '스컬킹', category: '트릭테이킹', inSharedCabinet: true, owner: { displayName: '박씨', username: 'park.c' } }),
      game({ name: '아그리콜라', category: '전략', owner: { displayName: null, username: 'kim.b' } }),
      game({ name: '이름없는게임' }),
    ] as never);
  });

  it('비로그인이면 보유자 실명을 숨긴다(회원 명부와 같은 실명 노출 기준)', async () => {
    await page();
    const card = screen.getByRole('heading', { level: 3, name: '스컬킹' }).closest('article')!;
    expect(card).not.toHaveTextContent('박씨');
    expect(card).not.toHaveTextContent('보유자');
  });

  it('카테고리(없으면 미분류), 보유자(회원에게만), 공용 보관함 배지를 표시', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1' } as never);
    await page();
    const card = (name: string) => screen.getByRole('heading', { level: 3, name }).closest('article')!;
    expect(card('스컬킹')).toHaveTextContent('트릭테이킹');
    expect(card('스컬킹')).toHaveTextContent('박씨');
    expect(card('스컬킹')).toHaveTextContent('공용 보관함');
    // 실명이 없으면 아이디로 보유자를 표시
    expect(card('아그리콜라')).toHaveTextContent('kim.b');
    expect(card('아그리콜라')).not.toHaveTextContent('공용 보관함');
    expect(card('이름없는게임')).toHaveTextContent('미분류');
  });

  it('?cabinet=1 이면 공용 보관함 게임만', async () => {
    await page({ cabinet: '1' });
    expect(titles()).toEqual(['스컬킹']);
  });

  it('?category= 로 카테고리 필터', async () => {
    await page({ category: '전략' });
    expect(titles()).toEqual(['아그리콜라']);
  });

  it('미분류 필터', async () => {
    await page({ category: '미분류' });
    expect(titles()).toEqual(['이름없는게임']);
  });

  it('필터 링크: 전체 + 보관함 + 카테고리(가나다순, 미분류는 맨 뒤)와 개수', async () => {
    await page({ category: '전략' });
    const filters = screen.getByRole('navigation', { name: '보드게임 필터' });
    const links = Array.from(filters.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['전체 3', '/boardgames'],
      ['공용 보관함 1', '/boardgames?cabinet=1'],
      ['전략 1', '/boardgames?category=%EC%A0%84%EB%9E%B5'],
      ['트릭테이킹 1', '/boardgames?category=%ED%8A%B8%EB%A6%AD%ED%85%8C%EC%9D%B4%ED%82%B9'],
      ['미분류 1', '/boardgames?category=%EB%AF%B8%EB%B6%84%EB%A5%98'],
    ]);
    expect(screen.getByRole('link', { name: '전략 1' })).toHaveAttribute('aria-current', 'page');
  });

  it('필터 결과가 없으면 안내', async () => {
    await page({ category: '없는분류' });
    expect(screen.getByText('조건에 맞는 보드게임이 없습니다.')).toBeInTheDocument();
  });
});

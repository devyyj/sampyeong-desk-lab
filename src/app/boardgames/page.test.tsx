import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '@/db';
import { getSession } from '@/lib/session';
import BoardGamesPage from './page';

vi.mock('@/db', () => ({ db: { query: { boardGames: { findMany: vi.fn() } } } }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/components/DeleteBoardGameButton', () => ({ default: () => null }));
// next/form은 라우터 컨텍스트가 필요하다. 여기서는 GET 폼으로 렌더되는 모양(action·입력 이름)만 본다.
vi.mock('next/form', () => ({ default: (props: React.ComponentProps<'form'>) => <form {...props} /> }));

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
      game({ name: '스컬킹', category: '트릭테이킹', inSharedCabinet: true, owner: { displayName: '박씨', nickname: '스컬러' } }),
      game({ name: '아그리콜라', category: '전략', owner: { displayName: null, nickname: '비비' } }),
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
    // 실명이 없으면 닉네임으로 보유자를 표시(아이디는 로그인에만 쓴다)
    expect(card('아그리콜라')).toHaveTextContent('보유자 비비');
    expect(card('아그리콜라')).not.toHaveTextContent('공용 보관함');
    expect(card('이름없는게임')).toHaveTextContent('미분류');
  });

  it('보관 상태(보관 중·플레이 중·대여 중)는 표시하지 않고 공용 보관함 여부만 보여준다', async () => {
    vi.mocked(db.query.boardGames.findMany).mockResolvedValue([game({ name: '대여게임', status: 'BORROWED' })] as never);
    await page();
    const card = screen.getByRole('heading', { level: 3, name: '대여게임' }).closest('article')!;
    expect(card).not.toHaveTextContent(/보관 중|플레이 중|대여 중/);
  });

  describe('검색', () => {
    it('게임 이름으로 찾는다(대소문자·띄어쓰기 무시)', async () => {
      await page({ q: '스컬 킹' });
      expect(titles()).toEqual(['스컬킹']);
      expect(screen.getByRole('searchbox', { name: '보드게임 검색' })).toHaveValue('스컬 킹');
    });

    it('회원은 보유자 실명·닉네임으로도 찾는다', async () => {
      vi.mocked(getSession).mockResolvedValue({ userId: 'u1' } as never);
      await page({ q: '박씨' });
      expect(titles()).toEqual(['스컬킹']);
      await page({ q: '비비' });
      expect(titles()).toContain('아그리콜라');
    });

    it('비회원은 보유자가 보이지 않으므로 보유자로는 찾지 않는다(검색으로 보유 여부를 알아낼 수 없게)', async () => {
      await page({ q: '박씨' });
      expect(screen.getByText('조건에 맞는 보드게임이 없습니다.')).toBeInTheDocument();
      expect(screen.getByRole('searchbox', { name: '보드게임 검색' })).toHaveAttribute('placeholder', '게임 이름');
    });

    it('검색어는 필터와 함께 쓴다: 검색 폼은 지금 필터를, 필터 링크는 검색어를 유지한다', async () => {
      const { container } = await page({ q: '게임', cabinet: '1' });
      expect(screen.getByText('조건에 맞는 보드게임이 없습니다.')).toBeInTheDocument();
      const form = screen.getByRole('search');
      expect(form).toHaveAttribute('action', '/boardgames');
      expect(container.querySelector('input[type="hidden"][name="cabinet"]')).toHaveValue('1');
      const filters = screen.getByRole('navigation', { name: '보드게임 필터' });
      expect(filters.querySelector('a')).toHaveAttribute('href', '/boardgames?q=%EA%B2%8C%EC%9E%84');
      expect(screen.getByRole('link', { name: /공용 보관함/ })).toHaveAttribute('href', '/boardgames?cabinet=1&q=%EA%B2%8C%EC%9E%84');
      // 검색어 지우기는 필터를 그대로 둔다.
      expect(screen.getByRole('link', { name: '검색 지우기' })).toHaveAttribute('href', '/boardgames?cabinet=1');
    });

    it('검색어가 없으면 지우기 링크가 없다', async () => {
      await page({ q: '  ' });
      expect(titles()).toHaveLength(3);
      expect(screen.queryByRole('link', { name: '검색 지우기' })).toBeNull();
    });
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

  it('목록은 이미지 없이 한 줄 정보만: 썸네일이 있어도 img를 그리지 않는다', async () => {
    vi.mocked(db.query.boardGames.findMany).mockResolvedValue([
      game({ name: '사진있는게임', thumbnailUrl: 'https://x/t.png', recommendedPlayers: '2~4명', playTime: '30분', category: '전략' }),
    ] as never);
    await page();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('No Image')).toBeNull();
    const row = screen.getByRole('heading', { level: 3, name: '사진있는게임' }).closest('article')!;
    expect(row).toHaveTextContent('전략 · 2~4명 · 30분');
  });
});

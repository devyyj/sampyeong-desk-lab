import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '@/db';
import { getSession } from '@/lib/session';
import { getSeasonCounts } from '@/lib/member-badges';
import MembersPage from './page';

vi.mock('@/db', () => ({
  db: { query: { seasons: { findMany: vi.fn() }, seasonMembers: { findMany: vi.fn() } } },
}));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/member-badges', () => ({ getSeasonCounts: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const user = (o: Record<string, unknown>) => ({
  id: 'x', username: 'x', nickname: 'x', displayName: null, department: '개발팀', bio: null, profileImageUrl: null, mustChangePin: false, ...o,
});

const page = async (season?: string) => render(await MembersPage({ searchParams: Promise.resolve({ season }) }));

describe('MembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1' } as never);
    vi.mocked(db.query.seasons.findMany).mockResolvedValue([
      { id: 1, name: '시즌 1', period: '25년 4분기' },
      { id: 2, name: '시즌 2', period: '26년 1분기' },
    ] as never);
    vi.mocked(db.query.seasonMembers.findMany).mockResolvedValue([
      { role: null, user: user({ id: 'b', username: 'kim.b', nickname: '비비', displayName: '김비', mustChangePin: true }) },
      { role: '회장', user: user({ id: 'c', username: 'park.c', displayName: '박씨', bio: '보드게임 좋아요' }) },
      { role: null, user: user({ id: 'a', username: 'an.a', displayName: '안에이' }) },
    ] as never);
    vi.mocked(getSeasonCounts).mockResolvedValue(new Map([['b', 1], ['c', 3], ['a', 2]]));
  });

  it('최근 시즌 명부를 회장 → 이름순으로 보여준다', async () => {
    await page();
    expect(screen.getByRole('heading', { name: '시즌 2 회원 명부 (3명)' })).toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['박씨', '김비', '안에이']);
  });

  it('이름 옆에 닉네임과 👑 회장(그 시즌 직책) 또는 Lv.N(참여 시즌 수)을 함께 표시한다', async () => {
    await page();
    const card = (name: string) => screen.getByRole('heading', { level: 3, name }).parentElement!;
    expect(card('김비')).toHaveTextContent('김비비비Lv.1');
    // 회장은 참여 수 대신 회장으로만 표시한다.
    expect(card('박씨')).toHaveTextContent('👑회장');
    expect(card('박씨')).not.toHaveTextContent('Lv.');
    expect(card('안에이')).toHaveTextContent('Lv.2');
    expect(getSeasonCounts).toHaveBeenCalledWith(['b', 'c', 'a']);
  });

  it('실명이 없으면 닉네임을 이름 자리에 한 번만 쓴다', async () => {
    vi.mocked(db.query.seasonMembers.findMany).mockResolvedValueOnce([
      { role: null, user: user({ id: 'n', nickname: '닉만' }) },
    ] as never);
    await page();
    expect(screen.getByRole('heading', { level: 3, name: '닉만' })).toBeInTheDocument();
    expect(screen.getAllByText('닉만')).toHaveLength(1);
  });

  it('미접속 배지와 부서·자기소개를 표시(아이디는 로그인용이라 보여주지 않음)', async () => {
    await page();
    expect(screen.getAllByText('미접속')).toHaveLength(1);
    expect(screen.getByText('비비')).toBeInTheDocument();
    expect(screen.queryByText('kim.b')).toBeNull();
    expect(screen.getByText('보드게임 좋아요')).toBeInTheDocument();
  });

  it('?season=1 이면 시즌 1 명부', async () => {
    await page('1');
    expect(screen.getByRole('heading', { name: '시즌 1 회원 명부 (3명)' })).toBeInTheDocument();
  });

  it('시즌이 없으면 명부를 조회하지 않고 안내', async () => {
    vi.mocked(db.query.seasons.findMany).mockResolvedValueOnce([] as never);
    await page();
    expect(db.query.seasonMembers.findMany).not.toHaveBeenCalled();
    expect(screen.getByText('등록된 시즌이 없습니다.')).toBeInTheDocument();
  });

  it('비회원이면 명부를 조회하지 않고 로그인 안내와 로그인 링크를 보여준다', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await page('1');
    expect(db.query.seasonMembers.findMany).not.toHaveBeenCalled();
    expect(screen.getByText('회원 명부는 로그인해야 확인할 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login?redirect=%2Fmembers%3Fseason%3D1');
    expect(screen.queryByText('kim.b')).toBeNull();
  });
});

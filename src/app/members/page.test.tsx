import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '@/db';
import MembersPage from './page';

vi.mock('@/db', () => ({
  db: { query: { seasons: { findMany: vi.fn() }, seasonMembers: { findMany: vi.fn() } } },
}));

const user = (o: Record<string, unknown>) => ({
  username: 'x', displayName: null, department: '개발팀', bio: null, profileImageUrl: null, mustChangePin: false, ...o,
});

const page = async (season?: string) => render(await MembersPage({ searchParams: Promise.resolve({ season }) }));

describe('MembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.query.seasons.findMany).mockResolvedValue([
      { id: 1, name: '시즌 1', period: '25년 4분기' },
      { id: 2, name: '시즌 2', period: '26년 1분기' },
    ] as never);
    vi.mocked(db.query.seasonMembers.findMany).mockResolvedValue([
      { role: null, user: user({ username: 'kim.b', displayName: '김비', mustChangePin: true }) },
      { role: '회장', user: user({ username: 'park.c', displayName: '박씨', bio: '보드게임 좋아요' }) },
      { role: null, user: user({ username: 'an.a', displayName: '안에이' }) },
    ] as never);
  });

  it('최근 시즌 명부를 회장 → 이름순으로 보여준다', async () => {
    await page();
    expect(screen.getByRole('heading', { name: '시즌 2 회원 명부 (3명)' })).toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['박씨', '김비', '안에이']);
  });

  it('직책·미접속 배지와 아이디·부서·자기소개를 표시', async () => {
    await page();
    expect(screen.getByText('회장')).toBeInTheDocument();
    expect(screen.getAllByText('미접속')).toHaveLength(1);
    expect(screen.getByText('kim.b')).toBeInTheDocument();
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
});

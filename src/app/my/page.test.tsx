import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '@/db';
import { getSession } from '@/lib/session';
import MyPage from './page';

vi.mock('@/db', () => ({ db: { query: { users: { findFirst: vi.fn() } } } }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/app/actions/auth', () => ({ logout: vi.fn() }));

const page = async () => render(await MyPage());

describe('MyPage (/my)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      nickname: '미플러', department: '개발팀', bio: '보드게임 좋아요', profileImageUrl: null,
    } as never);
  });

  it('비회원: 로그인 버튼과 동호회 안내만 보이고 DB는 조회하지 않는다', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await page();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login?redirect=%2Fmy');
    expect(screen.getByRole('link', { name: /회칙/ })).toHaveAttribute('href', '/about/rules');
    expect(screen.getByRole('link', { name: /공용 보관함 안내/ })).toHaveAttribute('href', '/about/shared-cabinet');
    expect(screen.queryByRole('button', { name: '로그아웃' })).toBeNull();
    expect(screen.queryByRole('link', { name: /프로필 편집/ })).toBeNull();
    expect(db.query.users.findFirst).not.toHaveBeenCalled();
  });

  it('회원: 프로필 요약, 프로필 편집, 동호회 안내, 로그아웃', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1', isAdmin: false } as never);
    await page();
    expect(screen.getByRole('heading', { name: '미플러' })).toBeInTheDocument();
    expect(screen.getByText('개발팀')).toBeInTheDocument();
    expect(screen.getByText('보드게임 좋아요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /프로필 편집/ })).toHaveAttribute('href', '/mypage');
    expect(screen.getByRole('link', { name: /회칙/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '로그인' })).toBeNull();
    // 관리자 메뉴는 관리자에게만
    expect(screen.queryByRole('link', { name: /회원 관리/ })).toBeNull();
  });

  it('관리자에게만 회원 관리(/admin/members) 메뉴', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1', isAdmin: true } as never);
    await page();
    expect(screen.getByRole('link', { name: /회원 관리/ })).toHaveAttribute('href', '/admin/members');
  });
});

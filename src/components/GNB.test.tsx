import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import GNB from './GNB';

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/') }));
vi.mock('@/app/actions/auth', () => ({ logout: vi.fn() }));

const desktopNav = () => screen.getByRole('navigation', { name: '주요 메뉴' });

describe('GNB', () => {
  it('5개 메뉴를 순서대로 보여준다', () => {
    render(<GNB isLoggedIn={false} isAdmin={false} />);
    const links = within(desktopNav()).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['자유게시판', '/'],
      ['활동 기록', '/activities'],
      ['보드게임', '/boardgames'],
      ['회원 명부', '/members'],
      ['동호회 안내', '/about/rules'],
    ]);
  });

  it('하위 경로에서도 해당 메뉴를 현재 메뉴로 표시(자유게시판은 / 에서만)', () => {
    vi.mocked(usePathname).mockReturnValue('/activities/abc');
    render(<GNB isLoggedIn={false} isAdmin={false} />);
    expect(within(desktopNav()).getByRole('link', { name: '활동 기록' })).toHaveAttribute('aria-current', 'page');
    expect(within(desktopNav()).getByRole('link', { name: '자유게시판' })).not.toHaveAttribute('aria-current');
  });

  it('/about/shared-cabinet 에서는 동호회 안내가 현재 메뉴', () => {
    vi.mocked(usePathname).mockReturnValue('/about/shared-cabinet');
    render(<GNB isLoggedIn={false} isAdmin={false} />);
    expect(within(desktopNav()).getByRole('link', { name: '동호회 안내' })).toHaveAttribute('aria-current', 'page');
  });

  it('비로그인: 로그인 링크만 있고 마이페이지·로그아웃·회원가입은 없음(계정은 관리자가 발급)', () => {
    render(<GNB isLoggedIn={false} isAdmin={false} />);
    expect(screen.getByRole('link', { name: '로그인' })).toBeInTheDocument();
    expect(screen.queryByText('마이페이지')).not.toBeInTheDocument();
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument();
    expect(screen.queryByText('회원가입')).not.toBeInTheDocument();
  });

  it('로그인: 마이페이지와 로그아웃, 로그인 링크 없음', () => {
    render(<GNB isLoggedIn isAdmin={false} />);
    expect(screen.queryByText('로그인')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '마이페이지' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
  });

  it('관리자에게만 관리자 메뉴(/admin/members)', () => {
    const { unmount } = render(<GNB isLoggedIn isAdmin />);
    expect(screen.getByRole('link', { name: '관리자' })).toHaveAttribute('href', '/admin/members');
    unmount();
    render(<GNB isLoggedIn isAdmin={false} />);
    expect(screen.queryByText('관리자')).not.toBeInTheDocument();
  });

  it('모바일 메뉴 버튼으로 패널을 열고, 메뉴를 누르면 닫힌다', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    render(<GNB isLoggedIn={true} isAdmin={false} />);
    const toggle = screen.getByRole('button', { name: '메뉴 열기' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: '모바일 메뉴' })).toBeNull();

    fireEvent.click(toggle);
    const mobile = screen.getByRole('navigation', { name: '모바일 메뉴' });
    expect(screen.getByRole('button', { name: '메뉴 닫기' })).toHaveAttribute('aria-expanded', 'true');
    // 모바일에서는 상단 오른쪽 계정 링크도 패널 안에서 접근할 수 있어야 한다.
    expect(within(mobile).getByRole('link', { name: '마이페이지' })).toBeInTheDocument();

    fireEvent.click(within(mobile).getByRole('link', { name: '활동 기록' }));
    expect(screen.queryByRole('navigation', { name: '모바일 메뉴' })).toBeNull();
  });
});

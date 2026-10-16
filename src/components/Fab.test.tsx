import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import Fab from './Fab';

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/') }));

describe('Fab', () => {
  it('피드에서 회원에게는 글쓰기로 바로 가는 버튼', () => {
    render(<Fab isLoggedIn isAdmin={false} />);
    expect(screen.getByRole('link', { name: '글쓰기' })).toHaveAttribute('href', '/posts/write');
  });

  it('비회원은 로그인 후 글쓰기로 돌아오도록 redirect를 붙인다', () => {
    render(<Fab isLoggedIn={false} isAdmin={false} />);
    expect(screen.getByRole('link', { name: '글쓰기' })).toHaveAttribute('href', '/login?redirect=%2Fposts%2Fwrite');
  });

  it('보드게임 탭에서는 보드게임 등록', () => {
    vi.mocked(usePathname).mockReturnValue('/boardgames');
    render(<Fab isLoggedIn isAdmin={false} />);
    expect(screen.getByRole('link', { name: '보드게임 등록' })).toHaveAttribute('href', '/boardgames/add');
  });

  it('회원 탭에서는 관리자에게만 회원 추가', () => {
    vi.mocked(usePathname).mockReturnValue('/members');
    const { unmount } = render(<Fab isLoggedIn isAdmin={false} />);
    expect(screen.queryByRole('link')).toBeNull();
    unmount();
    render(<Fab isLoggedIn isAdmin />);
    expect(screen.getByRole('link', { name: '회원 추가' })).toHaveAttribute('href', '/members/new');
  });

  it.each(['/activities', '/my', '/posts/write'])('그 외 화면(%s)에서는 보이지 않는다', (pathname) => {
    vi.mocked(usePathname).mockReturnValue(pathname);
    render(<Fab isLoggedIn isAdmin />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

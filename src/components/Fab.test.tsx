import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import Fab from './Fab';

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/') }));

describe('Fab', () => {
  it('피드에서 회원에게는 글쓰기로 바로 가는 버튼', () => {
    render(<Fab isLoggedIn />);
    expect(screen.getByRole('link', { name: '글쓰기' })).toHaveAttribute('href', '/posts/write');
  });

  it('비회원은 로그인 후 글쓰기로 돌아오도록 redirect를 붙인다', () => {
    render(<Fab isLoggedIn={false} />);
    expect(screen.getByRole('link', { name: '글쓰기' })).toHaveAttribute('href', '/login?redirect=%2Fposts%2Fwrite');
  });

  it.each(['/activities', '/boardgames', '/my', '/posts/write'])('피드가 아닌 화면(%s)에서는 보이지 않는다', (pathname) => {
    vi.mocked(usePathname).mockReturnValue(pathname);
    render(<Fab isLoggedIn />);
    expect(screen.queryByRole('link', { name: '글쓰기' })).toBeNull();
  });
});

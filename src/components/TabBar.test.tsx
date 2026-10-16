import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import TabBar from './TabBar';

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/') }));

const nav = () => screen.getByRole('navigation', { name: '주요 메뉴' });

describe('TabBar', () => {
  it('탭 4개를 링크로 보여준다', () => {
    render(<TabBar />);
    expect(within(nav()).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['피드', '/'],
      ['보드게임', '/boardgames'],
      ['회원', '/members'],
      ['MY', '/my'],
    ]);
  });

  it('현재 탭에만 aria-current="page"', () => {
    vi.mocked(usePathname).mockReturnValue('/boardgames/abc');
    render(<TabBar />);
    expect(within(nav()).getByRole('link', { name: '보드게임' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav()).getByRole('link', { name: '피드' })).not.toHaveAttribute('aria-current');
  });

  it('MY 하위 화면(/about/rules)에서는 MY가 현재 탭', () => {
    vi.mocked(usePathname).mockReturnValue('/about/rules');
    render(<TabBar />);
    expect(within(nav()).getByRole('link', { name: 'MY' })).toHaveAttribute('aria-current', 'page');
  });

  it('글쓰기 화면에서는 탭바를 그리지 않는다', () => {
    vi.mocked(usePathname).mockReturnValue('/posts/write');
    render(<TabBar />);
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).toBeNull();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/') }));

describe('AppHeader', () => {
  it('모든 화면 위에 SDL 로고(홈 링크)와 동호회 이름을 보여준다', () => {
    vi.mocked(usePathname).mockReturnValue('/boardgames');
    render(<AppHeader />);
    const banner = screen.getByRole('banner');
    expect(screen.getByRole('link', { name: 'SDL 삼평동 책상 전략 연구소 홈' })).toHaveAttribute('href', '/');
    expect(banner).toHaveTextContent('SDL');
    expect(banner).toHaveTextContent('삼평동 책상 전략 연구소');
  });

  it('로고 헤더는 64px(h-16) 높이로 크게, 로고 마크도 크게 그린다', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    render(<AppHeader />);
    const banner = screen.getByRole('banner');
    expect(banner.firstElementChild).toHaveClass('h-16');
    expect(banner.querySelector('svg')).toHaveAttribute('width', '36');
  });

  it('전체 화면 작성 모드(글쓰기)에서는 숨긴다', () => {
    vi.mocked(usePathname).mockReturnValue('/posts/write');
    render(<AppHeader />);
    expect(screen.queryByRole('banner')).toBeNull();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('누른 탭이 서버 응답을 기다리지 않고 즉시 현재 탭으로 바뀐다', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    render(<TabBar />);
    // 경로(usePathname)는 아직 '/' 그대로인 상태 = 서버가 다음 화면을 그리는 중.
    fireEvent.click(within(nav()).getByRole('link', { name: '회원' }));
    expect(within(nav()).getByRole('link', { name: '회원' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav()).getByRole('link', { name: '피드' })).not.toHaveAttribute('aria-current');
  });

  it('이동이 끝나 경로가 바뀌면 경로 기준으로 다시 따른다', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    const { rerender } = render(<TabBar />);
    fireEvent.click(within(nav()).getByRole('link', { name: '회원' }));
    // 이후 다른 경로(예: 뒤로 가기로 /boardgames)로 바뀌면 눌렀던 탭 기록은 버린다.
    vi.mocked(usePathname).mockReturnValue('/boardgames');
    rerender(<TabBar />);
    expect(within(nav()).getByRole('link', { name: '보드게임' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav()).getByRole('link', { name: '회원' })).not.toHaveAttribute('aria-current');
  });

  it('새 탭으로 열기(Ctrl/⌘+클릭)는 현재 탭 표시를 바꾸지 않는다', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    render(<TabBar />);
    fireEvent.click(within(nav()).getByRole('link', { name: '회원' }), { ctrlKey: true });
    expect(within(nav()).getByRole('link', { name: '피드' })).toHaveAttribute('aria-current', 'page');
  });
});

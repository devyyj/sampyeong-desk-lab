import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LevelBadge from './LevelBadge';

describe('LevelBadge', () => {
  it('참여 시즌 수를 Lv.N으로', () => {
    render(<LevelBadge badge={{ kind: 'seasons', count: 5 }} />);
    expect(screen.getByText('Lv.5')).toBeInTheDocument();
  });

  it('레벨마다 명도 단계가 달라 높은 레벨일수록 진하게 보인다', () => {
    const tone = (count: number) => {
      const { container, unmount } = render(<LevelBadge badge={{ kind: 'seasons', count }} />);
      const value = (container.firstChild as HTMLElement).dataset.tone;
      unmount();
      return value;
    };
    expect([1, 2, 3, 4, 5, 7].map(tone)).toEqual(['1', '2', '3', '4', '5', '5']);
  });

  it('회장은 왕관 이모지와 함께 "회장"(이모지는 스크린 리더에서 숨김)', () => {
    const { container } = render(<LevelBadge badge={{ kind: 'president' }} />);
    expect(container).toHaveTextContent('👑회장');
    expect(screen.getByText('👑')).toHaveAttribute('aria-hidden', 'true');
  });
});

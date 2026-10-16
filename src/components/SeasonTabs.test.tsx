import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SeasonTabs from './SeasonTabs';

const seasons = [
  { id: 1, name: '시즌 1', period: '25년 4분기' },
  { id: 2, name: '시즌 2', period: '26년 1분기' },
];

describe('SeasonTabs', () => {
  it('최근 시즌부터 링크로 나열하고 선택된 시즌을 표시', () => {
    render(<SeasonTabs basePath="/activities" seasons={seasons} selectedId={1} />);
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/activities?season=2', '/activities?season=1']);
    expect(screen.getByRole('link', { name: /시즌 1/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /시즌 2/ })).not.toHaveAttribute('aria-current');
  });
});

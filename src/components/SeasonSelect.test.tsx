import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SeasonSelect from './SeasonSelect';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const seasons = [
  { id: 1, name: '시즌 1', period: '25년 4분기' },
  { id: 2, name: '시즌 2', period: '26년 1분기' },
];

describe('SeasonSelect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('최근 시즌부터 "이름 · 기간"으로 나열하고 선택된 시즌을 고른 상태로 보여준다', () => {
    render(<SeasonSelect basePath="/members" seasons={seasons} selectedId={1} />);
    const select = screen.getByRole('combobox', { name: '시즌 선택' });
    const options = within(select).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['시즌 2 · 26년 1분기', '시즌 1 · 25년 4분기']);
    expect(select).toHaveValue('1');
  });

  it('다른 시즌을 고르면 ?season= 주소로 이동한다(공유·뒤로 가기가 되도록 쿼리로 유지)', () => {
    render(<SeasonSelect basePath="/members" seasons={seasons} selectedId={2} />);
    fireEvent.change(screen.getByRole('combobox', { name: '시즌 선택' }), { target: { value: '1' } });
    expect(push).toHaveBeenCalledWith('/members?season=1');
  });
});

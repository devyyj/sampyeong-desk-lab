import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditBoardGameForm } from './edit-form';

vi.mock('@/app/actions/boardgame', () => ({ updateBoardGame: vi.fn() }));

const game = { id: 'g1', name: '스컬킹', category: '트릭테이킹', recommendedPlayers: null, playTime: null, inSharedCabinet: true };
const categories = ['전략', '트릭테이킹'];

describe('EditBoardGameForm', () => {
  it('보관 상태 선택 없이 공용 보관함 체크박스만 있고, 지금 값으로 채워져 있다', () => {
    render(<EditBoardGameForm game={game} categories={categories} />);
    expect(screen.queryByLabelText('상태')).toBeNull();
    expect(screen.getByRole('checkbox', { name: '공용 보관함에 보관' })).toBeChecked();
  });

  it('공용 보관함이 아니면 체크가 꺼져 있다', () => {
    render(<EditBoardGameForm game={{ ...game, inSharedCabinet: false }} categories={categories} />);
    expect(screen.getByRole('checkbox', { name: '공용 보관함에 보관' })).not.toBeChecked();
  });

  it('카테고리를 지금 값으로 채우고 이미 쓰는 카테고리를 추천한다', () => {
    const { container } = render(<EditBoardGameForm game={game} categories={categories} />);
    const input = screen.getByLabelText('카테고리');
    expect(input).toHaveValue('트릭테이킹');
    expect(container.querySelectorAll(`datalist#${input.getAttribute('list')} option`)).toHaveLength(2);
  });

  it('카테고리가 없으면 비어 있다', () => {
    render(<EditBoardGameForm game={{ ...game, category: null }} categories={categories} />);
    expect(screen.getByLabelText('카테고리')).toHaveValue('');
  });
});

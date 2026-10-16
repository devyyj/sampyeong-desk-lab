import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditBoardGameForm } from './edit-form';

vi.mock('@/app/actions/boardgame', () => ({ updateBoardGame: vi.fn() }));

const game = { id: 'g1', name: '스컬킹', recommendedPlayers: null, playTime: null, inSharedCabinet: true };

describe('EditBoardGameForm', () => {
  it('보관 상태 선택 없이 공용 보관함 체크박스만 있고, 지금 값으로 채워져 있다', () => {
    render(<EditBoardGameForm game={game} />);
    expect(screen.queryByLabelText('상태')).toBeNull();
    expect(screen.getByRole('checkbox', { name: '공용 보관함에 보관' })).toBeChecked();
  });

  it('공용 보관함이 아니면 체크가 꺼져 있다', () => {
    render(<EditBoardGameForm game={{ ...game, inSharedCabinet: false }} />);
    expect(screen.getByRole('checkbox', { name: '공용 보관함에 보관' })).not.toBeChecked();
  });
});

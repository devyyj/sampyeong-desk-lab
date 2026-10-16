import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AddBoardGamePage from './page';

vi.mock('@/app/actions/boardgame', () => ({ addBoardGame: vi.fn() }));

describe('AddBoardGamePage', () => {
  it('썸네일 업로드 입력란 없이 이름·인원·시간만 받는다', () => {
    const { container } = render(<AddBoardGamePage />);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByLabelText(/보드게임 이름/)).toBeInTheDocument();
    expect(screen.getByLabelText('추천 인원')).toBeInTheDocument();
    expect(screen.getByLabelText('플레이 시간')).toBeInTheDocument();
  });

  it('보관 상태 대신 공용 보관함 여부만 체크한다(기본은 꺼짐)', () => {
    render(<AddBoardGamePage />);
    const cabinet = screen.getByRole('checkbox', { name: '공용 보관함에 보관' });
    expect(cabinet).not.toBeChecked();
    expect(cabinet).toHaveAttribute('name', 'inSharedCabinet');
    expect(screen.queryByLabelText('상태')).toBeNull();
  });
});

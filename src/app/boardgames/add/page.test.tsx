import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddBoardGameForm } from './add-form';

vi.mock('@/app/actions/boardgame', () => ({ addBoardGame: vi.fn() }));

const categories = ['전략', '파티'];

describe('AddBoardGameForm', () => {
  it('썸네일 업로드 입력란 없이 이름·카테고리·인원·시간을 받는다', () => {
    const { container } = render(<AddBoardGameForm categories={categories} />);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByLabelText(/보드게임 이름/)).toBeInTheDocument();
    expect(screen.getByLabelText('카테고리')).toHaveAttribute('name', 'category');
    expect(screen.getByLabelText('추천 인원')).toBeInTheDocument();
    expect(screen.getByLabelText('플레이 시간')).toBeInTheDocument();
  });

  it('카테고리는 직접 입력하되, 이미 쓰는 카테고리를 추천 목록(datalist)으로 보여준다', () => {
    const { container } = render(<AddBoardGameForm categories={categories} />);
    const input = screen.getByLabelText('카테고리');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('maxLength', '50');
    const list = container.querySelector(`datalist#${input.getAttribute('list')}`)!;
    expect([...list.querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual(categories);
  });

  it('보관 상태 대신 공용 보관함 여부만 체크한다(기본은 꺼짐)', () => {
    render(<AddBoardGameForm categories={categories} />);
    const cabinet = screen.getByRole('checkbox', { name: '공용 보관함에 보관' });
    expect(cabinet).not.toBeChecked();
    expect(cabinet).toHaveAttribute('name', 'inSharedCabinet');
    expect(screen.queryByLabelText('상태')).toBeNull();
  });
});

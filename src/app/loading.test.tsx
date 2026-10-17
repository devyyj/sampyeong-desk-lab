import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Loading from './loading';

describe('Loading (화면 전환 중 스켈레톤)', () => {
  it('스크린 리더에 불러오는 중임을 알린다', () => {
    render(<Loading />);
    expect(screen.getByRole('status', { name: '불러오는 중' })).toBeInTheDocument();
  });
});

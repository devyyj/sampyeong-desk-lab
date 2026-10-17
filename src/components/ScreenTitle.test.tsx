import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScreenTitle from './ScreenTitle';

describe('ScreenTitle (탭 첫 화면 제목)', () => {
  it('제목 글자는 화면에 보이지 않지만 스크린 리더에는 h1으로 읽힌다', () => {
    render(<ScreenTitle title="피드" />);
    const heading = screen.getByRole('heading', { level: 1, name: '피드' });
    expect(heading).toHaveClass('sr-only');
  });
});

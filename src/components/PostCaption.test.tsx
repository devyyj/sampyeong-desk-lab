import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PostCaption, { needsClamp } from './PostCaption';

describe('needsClamp', () => {
  it('4줄 이상이거나 아주 길면 접는다', () => {
    expect(needsClamp('짧은 글')).toBe(false);
    expect(needsClamp('1\n2\n3')).toBe(false);
    expect(needsClamp('1\n2\n3\n4')).toBe(true);
    expect(needsClamp('가'.repeat(141))).toBe(true);
  });
});

describe('PostCaption', () => {
  it('긴 글은 접어 두고 "더 보기"를 누르면 전부 펼친다', () => {
    render(<PostCaption content={'1\n2\n3\n4\n5'} />);
    const text = screen.getByText(/1/);
    expect(text.className).toMatch(/line-clamp-3/);
    fireEvent.click(screen.getByRole('button', { name: '더 보기' }));
    expect(text.className).not.toMatch(/line-clamp-3/);
    expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
  });

  it('짧은 글에는 "더 보기"가 없다', () => {
    render(<PostCaption content="짧은 글" />);
    expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
  });

  it('사진 없는 글은 본문을 크게 보여준다', () => {
    render(<PostCaption content="글만" large />);
    expect(screen.getByText('글만').className).toMatch(/text-\[17px\]/);
  });
});

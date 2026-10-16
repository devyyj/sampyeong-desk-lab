import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ImageLightbox from './ImageLightbox';

const one = [{ src: 'https://x/a.png', alt: '게시글 사진' }];
const three = [
  { src: 'https://x/1.png', alt: '게시글 사진 1' },
  { src: 'https://x/2.png', alt: '게시글 사진 2' },
  { src: 'https://x/3.png', alt: '게시글 사진 3' },
];
const shown = () => within(screen.getByRole('dialog')).getByRole('img');

describe('ImageLightbox', () => {
  it('처음에는 작은 썸네일 버튼만 있고, 누르면 원본을 팝업으로 크게 보여준다', () => {
    render(<ImageLightbox images={one} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    const thumb = screen.getByRole('button', { name: '게시글 사진 크게 보기' });
    expect(thumb.querySelector('img')).toHaveAttribute('src', 'https://x/a.png');
    fireEvent.click(thumb);

    const dialog = screen.getByRole('dialog', { name: '게시글 사진' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(shown()).toHaveAttribute('src', 'https://x/a.png');
    // 한 장이면 이전/다음과 번호를 그리지 않는다.
    expect(within(dialog).queryByRole('button', { name: '다음 사진' })).toBeNull();
    expect(within(dialog).queryByText('1 / 1')).toBeNull();
  });

  it('닫기 버튼, ESC, 배경 클릭으로 닫히고 사진 자체를 누르면 닫히지 않는다', () => {
    render(<ImageLightbox images={one} />);
    const open = () => fireEvent.click(screen.getByRole('button', { name: '게시글 사진 크게 보기' }));

    open();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    open();
    fireEvent.click(shown());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('여러 장이면 썸네일을 모두 보여주고, 누른 사진부터 열린다', () => {
    render(<ImageLightbox images={three} />);
    expect(screen.getAllByRole('button', { name: /크게 보기$/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '게시글 사진 2 크게 보기' }));
    expect(shown()).toHaveAttribute('src', 'https://x/2.png');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('이전/다음 버튼과 ←/→ 키로 넘기고, 끝에서는 처음으로 돌아간다', () => {
    render(<ImageLightbox images={three} />);
    fireEvent.click(screen.getByRole('button', { name: '게시글 사진 3 크게 보기' }));

    fireEvent.click(screen.getByRole('button', { name: '다음 사진' }));
    expect(shown()).toHaveAttribute('src', 'https://x/1.png');
    expect(screen.getByRole('dialog', { name: '게시글 사진 1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '이전 사진' }));
    expect(shown()).toHaveAttribute('src', 'https://x/3.png');

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });
});

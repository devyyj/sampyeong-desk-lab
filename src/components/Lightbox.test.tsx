import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useState } from 'react';
import Lightbox from './Lightbox';

const three = [
  { src: 'https://x/1.png', alt: '게시글 사진 1' },
  { src: 'https://x/2.png', alt: '게시글 사진 2' },
  { src: 'https://x/3.png', alt: '게시글 사진 3' },
];
const shown = () => within(screen.getByRole('dialog')).getByRole('img');

function Harness({ images = three, start = 0, onClose = () => {} }: { images?: typeof three; start?: number; onClose?: () => void }) {
  const [index, setIndex] = useState(start);
  return <Lightbox images={images} index={index} onIndexChange={setIndex} onClose={onClose} />;
}

describe('Lightbox', () => {
  it('한 장이면 이전/다음과 번호를 그리지 않는다', () => {
    render(<Harness images={three.slice(0, 1)} />);
    const dialog = screen.getByRole('dialog', { name: '게시글 사진 1' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).queryByRole('button', { name: '다음 사진' })).toBeNull();
    expect(within(dialog).queryByText('1 / 1')).toBeNull();
  });

  it('닫기 버튼, ESC, 배경 클릭으로 닫고, 사진 자체를 누르면 닫지 않는다', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(shown());
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('이전/다음 버튼과 ←/→ 키로 넘기고, 끝에서는 처음으로 돌아간다', () => {
    render(<Harness start={2} />);
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

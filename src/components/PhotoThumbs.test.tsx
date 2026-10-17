import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PhotoThumbs from './PhotoThumbs';

const images = (n: number) => Array.from({ length: n }, (_, i) => ({ src: `https://x/${i}.png`, alt: `사진 ${i + 1}` }));

describe('PhotoThumbs (피드용 작은 사진 줄)', () => {
  it('사진을 작은 정사각 썸네일로 보여주고, 첫 장 말고는 화면에 가까워질 때 받는다', () => {
    render(<PhotoThumbs images={images(2)} />);
    const region = screen.getByRole('region', { name: '사진 2장' });
    const buttons = within(region).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['사진 1 크게 보기', '사진 2 크게 보기']);
    expect(region.querySelectorAll('img')[1]).toHaveAttribute('loading', 'lazy');
  });

  it('사진이 많아도 모두 한 줄에 두고 손으로 밀어(스와이프) 넘긴다', () => {
    render(<PhotoThumbs images={images(5)} />);
    const region = screen.getByRole('region', { name: '사진 5장' });
    // 예전처럼 3장만 보이고 +N으로 덮지 않는다.
    expect(within(region).getAllByRole('button')).toHaveLength(5);
    expect(within(region).queryByText('+2')).toBeNull();
    // 가로 스크롤 + 칸 단위로 멈추는 스냅(모바일 기본 관성 스와이프를 그대로 쓴다).
    expect(region).toHaveClass('overflow-x-auto', 'snap-x', 'snap-mandatory');
    expect(within(region).getAllByRole('button')[0]).toHaveClass('snap-start', 'shrink-0');
  });

  it('누르면 그 사진부터 전체 화면으로 보고, 다음 사진으로 넘겨 볼 수 있다', () => {
    render(<PhotoThumbs images={images(5)} />);
    fireEvent.click(screen.getByRole('button', { name: '사진 3 크게 보기' }));
    const viewer = screen.getByRole('dialog');
    expect(viewer).toHaveTextContent('3 / 5');
    fireEvent.click(within(viewer).getByRole('button', { name: '다음 사진' }));
    expect(viewer).toHaveTextContent('4 / 5');
  });

  it('사진이 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<PhotoThumbs images={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

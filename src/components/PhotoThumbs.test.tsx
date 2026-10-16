import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PhotoThumbs from './PhotoThumbs';

const images = (n: number) => Array.from({ length: n }, (_, i) => ({ src: `https://x/${i}.png`, alt: `사진 ${i + 1}` }));

describe('PhotoThumbs (피드용 작은 사진)', () => {
  it('최대 3장을 작은 정사각 썸네일로 보여준다', () => {
    render(<PhotoThumbs images={images(2)} />);
    const region = screen.getByRole('region', { name: '사진 2장' });
    const buttons = within(region).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['사진 1 크게 보기', '사진 2 크게 보기']);
    expect(region.querySelectorAll('img')[1]).toHaveAttribute('loading', 'lazy');
  });

  it('4장 이상이면 3장만 보이고 세 번째 칸에 남은 장수(+N)', () => {
    render(<PhotoThumbs images={images(5)} />);
    const region = screen.getByRole('region', { name: '사진 5장' });
    expect(within(region).getAllByRole('button')).toHaveLength(3);
    expect(within(region).getByText('+2')).toBeInTheDocument();
    // 숨은 사진이 있다는 것을 버튼 이름으로도 알린다.
    expect(within(region).getAllByRole('button')[2]).toHaveAccessibleName('사진 3 크게 보기 (2장 더)');
  });

  it('누르면 그 사진부터 전체 화면으로 보고, 숨은 사진까지 넘겨 볼 수 있다', () => {
    render(<PhotoThumbs images={images(5)} />);
    fireEvent.click(screen.getByRole('button', { name: '사진 3 크게 보기 (2장 더)' }));
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

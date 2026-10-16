import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PhotoCarousel from './PhotoCarousel';

const images = [1, 2, 3].map((n) => ({ src: `https://img/${n}.jpg`, alt: `게시글 사진 ${n}` }));

describe('PhotoCarousel', () => {
  it('사진마다 "사진 n/N" 슬라이드와 현재 위치 표시', () => {
    render(<PhotoCarousel images={images} />);
    const region = screen.getByRole('region', { name: '사진 3장' });
    expect(within(region).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual([
      '사진 1/3',
      '사진 2/3',
      '사진 3/3',
    ]);
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('첫 사진만 바로 받고 나머지는 지연 로딩', () => {
    render(<PhotoCarousel images={images} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs[0]).not.toHaveAttribute('loading', 'lazy');
    expect(imgs[1]).toHaveAttribute('loading', 'lazy');
  });

  it('←/→ 키로 넘기면 위치 표시가 바뀐다(끝에서 멈춤)', () => {
    render(<PhotoCarousel images={images} />);
    const region = screen.getByRole('region', { name: '사진 3장' });
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(screen.getByText('2/3')).toBeInTheDocument();
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(screen.getByText('3/3')).toBeInTheDocument();
    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('한 장이면 위치 표시를 그리지 않는다', () => {
    render(<PhotoCarousel images={images.slice(0, 1)} />);
    expect(screen.getByRole('region', { name: '사진 1장' })).toBeInTheDocument();
    expect(screen.queryByText('1/1')).toBeNull();
  });

  it('사진을 누르면 그 사진부터 전체 화면으로 크게 본다', () => {
    render(<PhotoCarousel images={images} />);
    fireEvent.click(screen.getByRole('button', { name: '게시글 사진 2 크게 보기' }));
    const viewer = screen.getByRole('dialog', { name: '게시글 사진 2' });
    expect(within(viewer).getByText('2 / 3')).toBeInTheDocument();
  });
});

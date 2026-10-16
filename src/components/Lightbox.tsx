'use client';

import { useCallback } from 'react';
import Overlay from './Overlay';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './icons';

export type LightboxImage = { src: string; alt: string };

/**
 * 사진을 화면 가득 원본 비율로 보는 뷰어. 보고 있는 순서(index)는 부모가 관리한다.
 * 여러 장이면 이전/다음 버튼·←/→ 키로 넘기고 "n / N"을 표시한다. 끝에서 넘기면 처음으로 돌아간다.
 * 닫기: 닫기 버튼, ESC, 배경 클릭(사진 클릭은 제외) — Overlay가 처리한다.
 */
export default function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const count = images.length;
  const step = useCallback((delta: number) => onIndexChange((index + delta + count) % count), [index, count, onIndexChange]);
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    },
    [step],
  );
  const current = images[index];
  if (!current) return null;

  const roundButton = 'absolute w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center backdrop-blur hover:bg-white/25';

  return (
    <Overlay label={current.alt} onClose={onClose} onKeyDown={count > 1 ? onKeyDown : undefined} className="bg-black/95">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current.src} alt={current.alt} className="max-w-full max-h-full object-contain" />
      <button type="button" onClick={onClose} aria-label="닫기" className={`${roundButton} top-[calc(1rem+env(safe-area-inset-top))] right-4`}>
        <CloseIcon size={22} />
      </button>
      {count > 1 && (
        <>
          <button type="button" aria-label="이전 사진" onClick={() => step(-1)} className={`${roundButton} left-3 top-1/2 -translate-y-1/2`}>
            <ChevronLeftIcon size={24} />
          </button>
          <button type="button" aria-label="다음 사진" onClick={() => step(1)} className={`${roundButton} right-3 top-1/2 -translate-y-1/2`}>
            <ChevronRightIcon size={24} />
          </button>
          <p className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/15 text-white text-sm tabular-nums">
            {`${index + 1} / ${count}`}
          </p>
        </>
      )}
    </Overlay>
  );
}

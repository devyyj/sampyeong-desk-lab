'use client';

import { useCallback, useState } from 'react';
import Overlay from './Overlay';

type Image = { src: string; alt: string };

/**
 * 게시글 사진 목록을 작은 썸네일 줄로 보여주고, 누르면 그 사진부터 화면 가득 팝업으로 띄운다.
 * 여러 장이면 이전/다음 버튼·←/→ 키로 넘기고 "n / N"을 표시한다. 끝에서 넘기면 처음으로 돌아간다.
 * 닫기: 닫기 버튼, ESC, 배경 클릭(사진 클릭은 제외) — Overlay가 처리한다.
 */
export default function ImageLightbox({ images }: { images: Image[] }) {
  // null = 닫힘, 숫자 = 보고 있는 사진 순서
  const [index, setIndex] = useState<number | null>(null);
  const count = images.length;

  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (delta: number) => setIndex((i) => (i === null ? i : (i + delta + count) % count)),
    [count],
  );
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    },
    [step],
  );

  if (count === 0) return null;
  const current = index === null ? null : images[index];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {images.map((image, i) => (
          <button
            key={image.src}
            type="button"
            aria-label={`${image.alt} 크게 보기`}
            onClick={() => setIndex(i)}
            className="block w-32 h-32 rounded-lg overflow-hidden bg-muted cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <img src={image.src} alt={image.alt} loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {current && (
        <Overlay label={current.alt} onClose={close} onKeyDown={count > 1 ? onKeyDown : undefined}>
          <img src={current.src} alt={current.alt} className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-white/90 text-black text-sm font-semibold hover:bg-white"
          >
            닫기
          </button>
          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="이전 사진"
                onClick={() => step(-1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-black text-lg font-bold hover:bg-white"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="다음 사진"
                onClick={() => step(1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-black text-lg font-bold hover:bg-white"
              >
                ›
              </button>
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-sm tabular-nums">
                {`${index! + 1} / ${count}`}
              </p>
            </>
          )}
        </Overlay>
      )}
    </>
  );
}

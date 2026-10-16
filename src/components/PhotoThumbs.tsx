'use client';

import { useCallback, useState } from 'react';
import Lightbox, { type LightboxImage } from './Lightbox';

const VISIBLE = 3;

/**
 * 피드 카드의 작은 사진 줄. 화면 폭 캐러셀은 사진 한 장이 화면 대부분을 차지해 피드를 훑기 어려워서,
 * 피드에서는 3칸 정사각 썸네일로 작게 보여주고 크게 보는 것은 Lightbox(누르면 전체 화면)와 상세 페이지 캐러셀에 맡긴다.
 * 4장 이상이면 3장만 보이고 세 번째 칸에 남은 장수(+N)를 덮는다. Lightbox에서는 숨은 사진까지 모두 넘겨 본다.
 */
export default function PhotoThumbs({ images }: { images: LightboxImage[] }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const close = useCallback(() => setViewing(null), []);
  const count = images.length;
  if (count === 0) return null;
  const hidden = count - VISIBLE;

  return (
    <div role="region" aria-label={`사진 ${count}장`} className="grid grid-cols-3 gap-1">
      {images.slice(0, VISIBLE).map((image, i) => {
        const more = i === VISIBLE - 1 && hidden > 0;
        return (
          <button
            key={image.src}
            type="button"
            aria-label={more ? `${image.alt} 크게 보기 (${hidden}장 더)` : `${image.alt} 크게 보기`}
            onClick={() => setViewing(i)}
            className="relative aspect-square overflow-hidden rounded-lg bg-muted cursor-zoom-in"
          >
            {/* 첫 장만 바로 받고 나머지는 화면에 가까워질 때 받는다(피드에 사진 글이 이어져도 데이터 절약). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              loading={i === 0 ? undefined : 'lazy'}
              draggable={false}
              className="w-full h-full object-cover"
            />
            {more && (
              <span aria-hidden="true" className="absolute inset-0 bg-black/50 text-white text-lg font-semibold flex items-center justify-center">
                {`+${hidden}`}
              </span>
            )}
          </button>
        );
      })}
      {viewing !== null && <Lightbox images={images} index={viewing} onIndexChange={setViewing} onClose={close} />}
    </div>
  );
}

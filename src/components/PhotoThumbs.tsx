'use client';

import { useCallback, useState } from 'react';
import Lightbox, { type LightboxImage } from './Lightbox';

/**
 * 피드 카드의 작은 사진 줄. 화면 폭 캐러셀은 사진 한 장이 화면 대부분을 차지해 피드를 훑기 어려워서,
 * 피드에서는 작은 정사각 썸네일로 보여주고 크게 보는 것은 Lightbox(누르면 전체 화면)와 상세 페이지 캐러셀에 맡긴다.
 *
 * 사진은 모두 한 줄에 두고 손으로 밀어(스와이프) 넘긴다. 예전에는 3장만 보이고 세 번째 칸을 +N으로 덮어,
 * 나머지 사진을 보려면 꼭 눌러서 전체 화면을 열어야 했다.
 * - 라이브러리 없이 CSS scroll-snap(가로 스크롤 + 칸 단위 멈춤)으로 모바일 기본 관성 스와이프를 그대로 쓴다.
 * - 칸 폭을 줄 폭의 약 40%로 두어 2장 반이 보이게 한다. 다음 사진이 잘려 보여야 옆으로 더 있다는 것을 알 수 있다.
 * - 줄 끝 사진이 카드 패딩에 딱 붙어 잘리지 않게 scroll-padding을 두지 않고 snap-start로 왼쪽에 맞춘다.
 */
export default function PhotoThumbs({ images }: { images: LightboxImage[] }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const close = useCallback(() => setViewing(null), []);
  const count = images.length;
  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label={`사진 ${count}장`}
      className="flex gap-1.5 overflow-x-auto snap-x snap-mandatory overscroll-x-contain no-scrollbar"
    >
      {images.map((image, i) => (
        <button
          key={image.src}
          type="button"
          aria-label={`${image.alt} 크게 보기`}
          onClick={() => setViewing(i)}
          className="relative shrink-0 snap-start w-[40%] aspect-square overflow-hidden rounded-lg bg-muted cursor-zoom-in"
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
        </button>
      ))}
      {viewing !== null && <Lightbox images={images} index={viewing} onIndexChange={setViewing} onClose={close} />}
    </div>
  );
}

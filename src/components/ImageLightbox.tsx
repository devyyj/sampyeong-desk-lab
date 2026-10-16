'use client';

import { useCallback, useState } from 'react';
import Lightbox, { type LightboxImage } from './Lightbox';

/**
 * 게시글 사진 목록을 작은 썸네일 줄로 보여주고, 누르면 그 사진부터 화면 가득 팝업으로 띄운다.
 * 전체 화면 뷰어는 Lightbox가 그린다(피드 캐러셀 PhotoCarousel과 공용).
 */
export default function ImageLightbox({ images }: { images: LightboxImage[] }) {
  // null = 닫힘, 숫자 = 보고 있는 사진 순서
  const [index, setIndex] = useState<number | null>(null);
  const close = useCallback(() => setIndex(null), []);

  if (images.length === 0) return null;

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt={image.alt} loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {index !== null && <Lightbox images={images} index={index} onIndexChange={setIndex} onClose={close} />}
    </>
  );
}

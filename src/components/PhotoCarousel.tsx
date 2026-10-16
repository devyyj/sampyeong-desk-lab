'use client';

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import Lightbox, { type LightboxImage } from './Lightbox';

/**
 * 화면 폭을 가득 채우는 사진 캐러셀(인스타그램 피드 방식). 피드 게시글·활동 상세에서 쓴다.
 *
 * - 넘기기는 라이브러리 없이 CSS scroll-snap으로 한다: 모바일 브라우저의 기본 관성 스와이프를 그대로 쓰므로 가볍고 자연스럽다.
 * - 현재 몇 번째인지는 스크롤 위치(scrollLeft / 폭)로 계산해 "n/N"과 점으로 보여준다.
 * - 키보드: 캐러셀에 포커스한 뒤 ←/→로 한 장씩 이동(끝에서 멈춤 — 스와이프와 같은 감각).
 * - 사진을 누르면 Lightbox로 원본 비율 전체 화면 보기.
 * - 비율은 4:5로 잘라(object-cover) 카드 높이를 일정하게 맞춘다. 원본은 Lightbox에서 잘리지 않고 보인다.
 */
export default function PhotoCarousel({ images, aspect = '4 / 5' }: { images: LightboxImage[]; aspect?: string }) {
  const [index, setIndex] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const count = images.length;
  const closeViewer = useCallback(() => setViewing(null), []);

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(count - 1, next));
    setIndex(clamped);
    const track = trackRef.current;
    // jsdom에는 요소 scrollTo가 없을 수 있어 있는 경우에만 부른다(위치 표시는 위 setIndex로 이미 갱신됨).
    track?.scrollTo?.({ left: clamped * track.clientWidth, behavior: 'smooth' });
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(index - 1);
    }
  };

  if (count === 0) return null;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={`사진 ${count}장`}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar bg-muted outline-none focus-visible:ring-2 focus-visible:ring-foreground"
        style={{ aspectRatio: aspect }}
      >
        {images.map((image, i) => (
          <div
            key={image.src}
            role="group"
            aria-roledescription="slide"
            aria-label={`사진 ${i + 1}/${count}`}
            className="w-full h-full shrink-0 snap-center"
          >
            <button
              type="button"
              aria-label={`${image.alt} 크게 보기`}
              onClick={() => setViewing(i)}
              tabIndex={-1}
              className="block w-full h-full cursor-zoom-in"
            >
              {/* 첫 장만 바로 받고 나머지는 넘길 때 받는다(피드에 사진 많은 글이 이어져도 데이터 절약). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={image.alt}
                loading={i === 0 ? undefined : 'lazy'}
                draggable={false}
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/55 text-white text-xs font-medium tabular-nums pointer-events-none">
            {`${index + 1}/${count}`}
          </span>
          <div className="flex justify-center gap-1 pt-2.5" aria-hidden="true">
            {images.map((image, i) => (
              <span
                key={image.src}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? 'bg-foreground' : 'bg-border'}`}
              />
            ))}
          </div>
        </>
      )}

      {viewing !== null && <Lightbox images={images} index={viewing} onIndexChange={setViewing} onClose={closeViewer} />}
    </div>
  );
}

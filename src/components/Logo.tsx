/**
 * SDL 로고. 마크(검정 둥근 사각형 안의 주사위 눈 3개 — 보드게임 동호회)와 글자 로고로 이뤄진다.
 * 별도 이미지 파일 없이 SVG로 그려 글자색(currentColor)·다크 모드를 그대로 따른다.
 * 같은 마크를 파비콘(app/icon.svg)에도 쓴다.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <circle cx="10" cy="10" r="2.6" className="fill-background" />
      <circle cx="16" cy="16" r="2.6" className="fill-background" />
      <circle cx="22" cy="22" r="2.6" className="fill-background" />
    </svg>
  );
}

/** 마크 + "SDL" + 동호회 이름. compact면 이름 줄을 생략한다. */
export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-black tracking-tight">SDL</span>
        {!compact && <span className="mt-0.5 text-[10px] font-medium text-muted-foreground tracking-tight">삼평동 책상 전략 연구소</span>}
      </span>
    </span>
  );
}

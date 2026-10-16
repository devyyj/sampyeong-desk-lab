/**
 * SDL 로고. 마크(검정 둥근 사각형 안에 S·D·L 타일 3장을 주사위 눈처럼 대각선으로 겹쳐 쌓은 모양 — 보드게임 동호회)와 글자 로고로 이뤄진다.
 * 별도 이미지 파일 없이 SVG로 그려 글자색(currentColor)·다크 모드를 그대로 따른다.
 * 같은 마크를 파비콘(app/icon.svg)·apple-icon·OG 이미지에도 쓴다.
 *
 * 타일 글자는 <text>가 아니라 Pretendard ExtraBold(800) 글리프를 path로 뽑아 넣었다.
 * 폰트가 늦게 받아지거나 없는 환경(파비콘, 이미지 변환)에서도 모양이 똑같아야 해서다.
 */
const TILES = [
  { x: 5, d: 'M16.14 11.04Q15.45 11.04 14.97 11.23Q14.48 11.41 14.24 11.74Q13.99 12.07 13.99 12.49Q13.97 13.15 14.54 13.53Q15.1 13.91 16.19 14.17L17.49 14.45Q19.72 14.95 20.86 16.04Q22 17.13 22.01 18.9Q22.01 20.29 21.31 21.3Q20.6 22.31 19.29 22.85Q17.98 23.39 16.14 23.39Q14.27 23.39 12.9 22.82Q11.52 22.26 10.77 21.12Q10.02 19.99 9.98 18.31H13.34Q13.39 19.01 13.74 19.5Q14.09 19.99 14.7 20.24Q15.3 20.48 16.09 20.48Q16.83 20.48 17.36 20.28Q17.89 20.08 18.18 19.72Q18.46 19.36 18.46 18.89Q18.46 18.46 18.21 18.15Q17.95 17.84 17.43 17.62Q16.9 17.39 16.05 17.2L14.49 16.84Q12.5 16.38 11.44 15.38Q10.38 14.37 10.38 12.73Q10.38 11.37 11.12 10.34Q11.86 9.3 13.17 8.72Q14.48 8.15 16.15 8.15Q17.84 8.15 19.12 8.72Q20.39 9.3 21.1 10.34Q21.8 11.39 21.81 12.77H18.46Q18.41 12.22 18.13 11.83Q17.85 11.44 17.35 11.24Q16.85 11.04 16.14 11.04Z' },
  { x: 21, d: 'M27.21 39.2V36.21H31.01Q32.34 36.21 33.2 35.76Q34.07 35.31 34.52 34.33Q34.97 33.35 34.97 31.77Q34.97 30.18 34.52 29.2Q34.08 28.22 33.2 27.78Q32.32 27.34 30.98 27.34H27.14V24.35H31.15Q33.41 24.35 35.06 25.24Q36.71 26.13 37.59 27.8Q38.47 29.47 38.47 31.77Q38.47 34.07 37.59 35.74Q36.7 37.42 35.05 38.31Q33.4 39.2 31.15 39.2ZM29.2 39.2H25.72V24.35H29.2Z' },
  { x: 37, d: 'M43.35 40.35H46.84V52.35H53.06V55.2H43.35Z' },
];

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="15" className="fill-foreground" />
      {/* 뒤 타일부터 그리고, 바탕색 테두리(2)로 겹친 경계를 갈라 카드를 쌓은 것처럼 보이게 한다. */}
      {TILES.map((t) => (
        <g key={t.x}>
          <rect x={t.x} y={t.x} width="22" height="22" rx="4.6" strokeWidth="2" className="fill-background stroke-foreground" />
          <path d={t.d} className="fill-foreground" />
        </g>
      ))}
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

// 배지 타입·표시 문구. 클라이언트 컴포넌트(UserName 등)도 쓰므로 DB 조회 코드(member-badges.ts)와 분리한다.
// 한 파일에 두면 클라이언트 번들에 postgres 드라이버가 끌려 들어가 빌드가 실패한다.

/** 닉네임 옆에 붙는 배지. 최신 시즌 회장은 레벨 대신 회장으로 표시한다. */
export type MemberBadge = { kind: 'president' } | { kind: 'seasons'; count: number };

/**
 * 레벨 시스템: 참여한 시즌 수가 곧 레벨이다(이번 시즌이 처음이면 Lv.1, 다섯 시즌 모두 참여하면 Lv.5).
 * 회장은 레벨과 상관없이 무조건 "회장"으로 표시한다(왕관 이모지는 LevelBadge가 붙인다).
 */
export function badgeLabel(badge: MemberBadge): string {
  return badge.kind === 'president' ? '회장' : `Lv.${badge.count}`;
}

/** 레벨 배지 명도 단계(1~5). */
export type LevelTone = 1 | 2 | 3 | 4 | 5;

/**
 * 레벨을 배지 명도 단계로 바꾼다. 레벨이 오를수록 진해지고(모노크롬 강조), 시즌이 계속 늘어도
 * Lv.5 이상은 가장 진한 단계로 이어진다. 0 이하·소수 같은 비정상 값은 가장 연한 단계로 본다.
 */
export function levelTone(count: number): LevelTone {
  return Math.min(5, Math.max(1, Math.floor(count))) as LevelTone;
}

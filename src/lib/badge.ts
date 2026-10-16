// 배지 타입·표시 문구. 클라이언트 컴포넌트(UserName 등)도 쓰므로 DB 조회 코드(member-badges.ts)와 분리한다.
// 한 파일에 두면 클라이언트 번들에 postgres 드라이버가 끌려 들어가 빌드가 실패한다.

/** 닉네임 옆에 붙는 배지. 최신 시즌 회장은 숫자 대신 회장으로 표시한다. */
export type MemberBadge = { kind: 'president' } | { kind: 'seasons'; count: number };

export function badgeLabel(badge: MemberBadge): string {
  return badge.kind === 'president' ? '회장' : `${badge.count}시즌`;
}

import { badgeLabel, type MemberBadge } from '@/lib/badge';

/**
 * 닉네임 옆 레벨 칩(Lv.N) / 회장 칩(👑 회장). 피드·댓글·프로필·회원 명부가 같은 모양을 쓴다.
 * 왕관은 장식이라 스크린 리더에서는 숨긴다("왕관 회장"이 아니라 "회장"으로 읽히게).
 * 모노크롬 톤이라 색 대신 연한 회색 바탕으로 구분하고, 회장만 진하게(검정 바탕) 강조한다.
 */
export default function LevelBadge({ badge, className = '' }: { badge: MemberBadge; className?: string }) {
  const president = badge.kind === 'president';
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded-md text-[11px] font-bold leading-4 align-middle tabular-nums ${
        president ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
      } ${className}`}
    >
      {president && <span aria-hidden="true">👑</span>}
      <span>{badgeLabel(badge)}</span>
    </span>
  );
}

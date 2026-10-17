import { badgeLabel, levelTone, type LevelTone, type MemberBadge } from '@/lib/badge';

/**
 * 레벨 단계별 배지 색(모노크롬 명도 단계). 레벨이 높을수록 진하게 보여 한눈에 고참 회원이 드러난다.
 * 다크 모드에서는 순서를 뒤집어 높은 레벨일수록 밝게(바탕과 대비가 커지게) 한다.
 * Tailwind가 클래스를 정적으로 찾을 수 있도록 문자열을 통째로 둔다(동적 조합 금지).
 */
const TONE_CLASS: Record<LevelTone, string> = {
  1: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  2: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  3: 'bg-zinc-400 text-white dark:bg-zinc-500 dark:text-white',
  4: 'bg-zinc-600 text-white dark:bg-zinc-300 dark:text-zinc-900',
  5: 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950',
};

/**
 * 닉네임 옆 레벨 칩(Lv.N) / 회장 칩(👑 회장). 피드·댓글·프로필·회원 명부가 같은 모양을 쓴다.
 * 왕관은 장식이라 스크린 리더에서는 숨긴다("왕관 회장"이 아니라 "회장"으로 읽히게).
 * 회장은 레벨과 상관없이 가장 진한 바탕(글자색 반전)에 왕관을 붙여 구분한다.
 */
export default function LevelBadge({ badge, className = '' }: { badge: MemberBadge; className?: string }) {
  const president = badge.kind === 'president';
  const tone = president ? null : levelTone(badge.count);
  return (
    <span
      data-tone={tone ?? undefined}
      className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded-md text-[12px] font-bold leading-4 align-middle tabular-nums ${
        president ? 'bg-foreground text-background' : TONE_CLASS[tone!]
      } ${className}`}
    >
      {president && <span aria-hidden="true">👑</span>}
      <span>{badgeLabel(badge)}</span>
    </span>
  );
}

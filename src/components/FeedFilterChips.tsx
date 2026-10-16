import Link from 'next/link';
import { chipClass } from '@/lib/chip';
import { feedFilterHref, type FeedFilter } from '@/lib/feed-filter';

/**
 * 피드 필터 칩(설계 §5.2). 첫 줄: 전체 · 활동 기록 · 자유글. 활동 기록을 고르면 둘째 줄에 종류 칩이 나온다.
 * 종류는 회원이 입력한 이름이라 고정 목록이 아니다: 실제로 쓰인 종류(types, 많이 쓴 순)로 칩을 만든다.
 * 필터는 주소(?kind=&type=)에 담아 링크로 바꾼다: 새로고침·공유·뒤로 가기에서도 같은 목록이 보이고,
 * 서버가 첫 페이지를 바로 그릴 수 있다. 한 줄을 넘치면 가로로 밀어 본다(첫 화면 높이를 아끼려고 줄바꿈하지 않음).
 */
export default function FeedFilterChips({ filter, types = [] }: { filter: FeedFilter; types?: string[] }) {
  const kinds: { label: string; value: FeedFilter }[] = [
    { label: '전체', value: { kind: 'all', type: null } },
    { label: '활동 기록', value: { kind: 'activity', type: null } },
    { label: '자유글', value: { kind: 'general', type: null } },
  ];
  const typeChips: { label: string; value: FeedFilter }[] = [
    { label: '모든 종류', value: { kind: 'activity', type: null } },
    // 주소로 들어온 종류가 목록에 없어도(오래된 링크·방금 지워진 종류) 지금 고른 칩이 보이게 끝에 붙인다.
    ...[...types, ...(filter.type && !types.includes(filter.type) ? [filter.type] : [])].map((type) => ({
      label: type,
      value: { kind: 'activity' as const, type },
    })),
  ];
  const row = (label: string, chips: { label: string; value: FeedFilter }[], isActive: (v: FeedFilter) => boolean) => (
    <nav aria-label={label} className="-mx-4 px-4 flex gap-1.5 overflow-x-auto no-scrollbar">
      {chips.map((chip) => {
        const active = isActive(chip.value);
        return (
          <Link
            key={chip.label}
            href={feedFilterHref(chip.value)}
            aria-current={active ? 'page' : undefined}
            className={chipClass(active)}
          >
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="mb-3 space-y-2">
      {row('글 종류', kinds, (v) => v.kind === filter.kind)}
      {filter.kind === 'activity' && row('활동 종류', typeChips, (v) => v.type === filter.type)}
    </div>
  );
}

import Link from 'next/link';

type Season = { id: number; name: string; period: string };

/**
 * 활동 기록과 회원 명부가 함께 쓰는 시즌 탭.
 * 선택 상태를 클라이언트 state가 아닌 ?season= 쿼리로 두어, 서버 컴포넌트에서 바로 조회하고 링크 공유·뒤로 가기가 되게 한다.
 * 최근 시즌을 가장 많이 보므로 최근 시즌부터 나열한다.
 */
export default function SeasonTabs({
  basePath,
  seasons,
  selectedId,
}: {
  basePath: string;
  seasons: Season[];
  selectedId: number;
}) {
  const ordered = [...seasons].sort((a, b) => b.id - a.id);

  return (
    <nav aria-label="시즌 선택" className="flex gap-2 overflow-x-auto pb-1">
      {ordered.map((season) => {
        const selected = season.id === selectedId;
        return (
          <Link
            key={season.id}
            href={`${basePath}?season=${season.id}`}
            aria-current={selected ? 'page' : undefined}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              selected
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {season.name}
            <span className={`ml-1 text-xs ${selected ? 'opacity-80' : 'opacity-70'}`}>{season.period}</span>
          </Link>
        );
      })}
    </nav>
  );
}

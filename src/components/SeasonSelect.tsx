'use client';

import { useRouter } from 'next/navigation';

type Season = { id: number; name: string; period: string };

/**
 * 회원 명부의 시즌 선택 셀렉트 박스(활동 기록은 시즌 선택 없이 전체를 무한 스크롤로 보여준다).
 * 시즌이 늘어나면 탭이 가로로 넘쳐서 셀렉트로 바꿨다.
 * 선택 상태는 클라이언트 state가 아닌 ?season= 쿼리로 둔다. 서버 컴포넌트가 그 값으로 바로 조회하고,
 * 링크 공유·뒤로 가기도 그대로 동작하게 하기 위함이다(그래서 onChange에서 주소를 바꾼다).
 * 최근 시즌을 가장 많이 보므로 최근 시즌부터 나열한다.
 */
export default function SeasonSelect({
  basePath,
  seasons,
  selectedId,
}: {
  basePath: string;
  seasons: Season[];
  selectedId: number;
}) {
  const router = useRouter();
  const ordered = [...seasons].sort((a, b) => b.id - a.id);

  return (
    <select
      aria-label="시즌 선택"
      value={String(selectedId)}
      onChange={(e) => router.push(`${basePath}?season=${e.target.value}`)}
      className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      {ordered.map((season) => (
        <option key={season.id} value={season.id}>
          {`${season.name} · ${season.period}`}
        </option>
      ))}
    </select>
  );
}

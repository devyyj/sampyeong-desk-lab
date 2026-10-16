import { db } from "@/db";
import { boardGames } from "../../../drizzle/schema";
import { asc, desc } from "drizzle-orm";
import { getSession } from "@/lib/session";
import Link from "next/link";
import Form from "next/form";
import DeleteBoardGameButton from "@/components/DeleteBoardGameButton";

export const dynamic = 'force-dynamic';

// 카테고리가 비어 있는 게임(이관 데이터 13개 등)을 고르는 필터 값이자 화면 표시명.
const UNCATEGORIZED = '미분류';

export default async function BoardGamesPage({
  searchParams,
}: {
  searchParams: Promise<{ cabinet?: string; category?: string; q?: string }>;
}) {
  const { cabinet, category, q } = await searchParams;
  const query = typeof q === 'string' ? q.trim() : '';
  const session = await getSession();
  const allGames = await db.query.boardGames.findMany({
    // 이관된 게임은 거의 같은 시각에 들어가 created_at만으로는 순서가 들쭉날쭉하므로 이름순을 보조 정렬로 둔다.
    orderBy: [desc(boardGames.createdAt), asc(boardGames.name)],
    // 보유자는 실명(없으면 닉네임)만 필요하다. 아이디는 로그인에만 쓰므로 가져오지 않는다(pin_hash 등도 마찬가지).
    with: { owner: { columns: { displayName: true, nickname: true } } },
  });

  // 게임이 86개 수준이라 필터는 DB 쿼리 대신 메모리에서 한다. 필터 링크의 개수도 같은 목록에서 바로 센다.
  const categoryOf = (game: (typeof allGames)[number]) => game.category || UNCATEGORIZED;
  const categoryCounts = new Map<string, number>();
  for (const game of allGames) {
    categoryCounts.set(categoryOf(game), (categoryCounts.get(categoryOf(game)) ?? 0) + 1);
  }
  const categories = [...categoryCounts.entries()].sort(([a], [b]) => {
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return a.localeCompare(b, 'ko');
  });
  const cabinetCount = allGames.filter((game) => game.inSharedCabinet).length;

  const cabinetOnly = cabinet === '1';
  const keyword = normalize(query);
  const games = allGames.filter(
    (game) =>
      (!cabinetOnly || game.inSharedCabinet) &&
      (!category || categoryOf(game) === category) &&
      (!keyword || searchTextOf(game, Boolean(session)).includes(keyword)),
  );

  // 필터 링크는 검색어를, 검색 폼은 지금 필터를 유지해 둘을 함께 쓸 수 있게 한다.
  const href = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    const qs = search.toString();
    return qs ? `/boardgames?${qs}` : '/boardgames';
  };
  const filters = [
    { label: `전체 ${allGames.length}`, href: href({ q: query }), active: !cabinetOnly && !category },
    { label: `공용 보관함 ${cabinetCount}`, href: href({ cabinet: '1', q: query }), active: cabinetOnly },
    ...categories.map(([name, count]) => ({
      label: `${name} ${count}`,
      href: href({ category: name, q: query }),
      active: category === name,
    })),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">보드게임 현황</h1>
          <p className="text-sm text-muted-foreground mt-1">SDL 회원들이 보유한 보드게임 목록입니다.</p>
        </div>
        {session && (
          <Link
            href="/boardgames/add"
            className="px-4 py-2 bg-foreground text-background rounded-full hover:bg-foreground/90 transition-colors text-sm font-semibold whitespace-nowrap"
          >
            새 보드게임 등록
          </Link>
        )}
      </div>

      {allGames.length > 0 && (
        // GET 폼이라 검색 결과도 ?q= 주소로 남아 공유·뒤로 가기가 된다. next/form이라 전체 새로고침 없이 이동한다.
        <Form action="/boardgames" role="search" className="flex gap-2">
          {cabinetOnly && <input type="hidden" name="cabinet" value="1" />}
          {category && <input type="hidden" name="category" value={category} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            aria-label="보드게임 검색"
            // 보유자는 회원에게만 보이므로 검색 대상도 회원에게만 넓힌다.
            placeholder={session ? '게임 이름 또는 보유자' : '게임 이름'}
            className="flex-1 min-w-0 px-4 py-2 border border-border rounded-full bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button type="submit" className="px-4 py-2 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90">
            검색
          </button>
          {query && (
            <Link
              href={href({ cabinet: cabinetOnly ? '1' : undefined, category })}
              className="self-center text-sm text-muted-foreground hover:text-foreground whitespace-nowrap"
            >
              검색 지우기
            </Link>
          )}
        </Form>
      )}

      {allGames.length > 0 && (
        <nav aria-label="보드게임 필터" className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Link
              key={filter.href}
              href={filter.href}
              aria-current={filter.active ? 'page' : undefined}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter.active
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </nav>
      )}

      {allGames.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground bg-card border border-border rounded-xl">
          <p>등록된 보드게임이 없습니다.</p>
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground bg-card border border-border rounded-xl">
          <p>조건에 맞는 보드게임이 없습니다.</p>
        </div>
      ) : (
        // 이미지 없이 한 게임당 한 줄: 이름·배지 / 카테고리·인원·시간·보유자. 86개 수준이라 한눈에 훑어볼 수 있게 했다.
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {games.map((game) => {
            const details = [categoryOf(game), game.recommendedPlayers, game.playTime].filter(Boolean).join(' · ');
            return (
              <article key={game.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="font-semibold text-foreground">{game.name}</h3>
                    {/* 보관 상태(보관 중·대여 중 등)는 관리하지 않고 공용 보관함에 있는지만 표시한다. */}
                    {game.inSharedCabinet && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary-100 text-primary-600">
                        공용 보관함
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {details}
                    {/* 보유자는 실명이라 회원 명부(/members)와 같은 기준으로 로그인한 회원에게만 보여준다. */}
                    {session && game.owner && <span>{` · 보유자 ${game.owner.displayName || game.owner.nickname}`}</span>}
                  </p>
                </div>
                {session && (
                  <div className="flex shrink-0 gap-2">
                    <Link href={`/boardgames/${game.id}/edit`} className="text-xs text-blue-500 hover:underline bg-blue-100 px-2 py-1 rounded">수정</Link>
                    <DeleteBoardGameButton id={game.id} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 검색 비교용: 대소문자·띄어쓰기 차이를 무시한다("스컬 킹"으로도 "스컬킹"을 찾도록). */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

/**
 * 게임 한 개의 검색 대상 문자열. 회원에게는 보유자 실명·닉네임도 포함한다.
 * 비회원은 화면에 보유자가 안 보이므로 검색 대상에서도 빼야 "이 사람으로 검색하면 나온다"로 보유 여부가 새지 않는다.
 */
function searchTextOf(
  game: { name: string; owner: { displayName: string | null; nickname: string } | null },
  includeOwner: boolean,
): string {
  const parts = [game.name];
  if (includeOwner && game.owner) parts.push(game.owner.displayName ?? '', game.owner.nickname);
  // 이름과 보유자를 이어 붙였을 때 경계를 넘어 우연히 맞지 않도록 구분자를 둔다(normalize가 지우지 않는 문자).
  return parts.map(normalize).join('\u0000');
}

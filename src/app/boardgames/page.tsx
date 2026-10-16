import { db } from "@/db";
import { boardGames } from "../../../drizzle/schema";
import { asc, desc } from "drizzle-orm";
import { getSession } from "@/lib/session";
import Link from "next/link";
import DeleteBoardGameButton from "@/components/DeleteBoardGameButton";

export const dynamic = 'force-dynamic';

// 카테고리가 비어 있는 게임(이관 데이터 13개 등)을 고르는 필터 값이자 화면 표시명.
const UNCATEGORIZED = '미분류';

export default async function BoardGamesPage({
  searchParams,
}: {
  searchParams: Promise<{ cabinet?: string; category?: string }>;
}) {
  const { cabinet, category } = await searchParams;
  const session = await getSession();
  const allGames = await db.query.boardGames.findMany({
    // 이관된 게임은 거의 같은 시각에 들어가 created_at만으로는 순서가 들쭉날쭉하므로 이름순을 보조 정렬로 둔다.
    orderBy: [desc(boardGames.createdAt), asc(boardGames.name)],
    // 보유자는 실명(없으면 아이디)만 필요하다. pin_hash 등은 가져오지 않는다.
    with: { owner: { columns: { displayName: true, username: true } } },
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
  const games = allGames.filter(
    (game) => (!cabinetOnly || game.inSharedCabinet) && (!category || categoryOf(game) === category),
  );

  const filters = [
    { label: `전체 ${allGames.length}`, href: '/boardgames', active: !cabinetOnly && !category },
    { label: `공용 보관함 ${cabinetCount}`, href: '/boardgames?cabinet=1', active: cabinetOnly },
    ...categories.map(([name, count]) => ({
      label: `${name} ${count}`,
      href: `/boardgames?category=${encodeURIComponent(name)}`,
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <article key={game.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col group relative">
              <div className="w-full aspect-video bg-muted relative overflow-hidden">
                {game.thumbnailUrl ? (
                  <img src={game.thumbnailUrl} alt={game.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium">
                    No Image
                  </div>
                )}
                <div className="absolute top-3 right-3 flex gap-1.5">
                  {game.inSharedCabinet && (
                    <span className="px-2.5 py-1 text-xs font-bold rounded-full shadow-sm backdrop-blur-md bg-primary-600/90 text-white">
                      공용 보관함
                    </span>
                  )}
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full shadow-sm backdrop-blur-md ${
                    game.status === 'AVAILABLE' ? 'bg-green-500/90 text-white' :
                    game.status === 'PLAYING' ? 'bg-blue-500/90 text-white' : 'bg-orange-500/90 text-white'
                  }`}>
                    {game.status === 'AVAILABLE' ? '보관 중' :
                     game.status === 'PLAYING' ? '플레이 중' : '대여 중'}
                  </span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-foreground">{game.name}</h3>
                  {session && (
                    <div className="flex gap-2">
                      <Link href={`/boardgames/${game.id}/edit`} className="text-xs text-blue-500 hover:underline bg-blue-100 px-2 py-1 rounded">수정</Link>
                      <DeleteBoardGameButton id={game.id} />
                    </div>
                  )}
                </div>

                <div className="space-y-2 mt-auto">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <span className="w-20 font-medium text-foreground">카테고리</span>
                    <span>{categoryOf(game)}</span>
                  </div>
                  {/* 보유자는 실명이라 회원 명부(/members)와 같은 기준으로 로그인한 회원에게만 보여준다. */}
                  {session && game.owner && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="w-20 font-medium text-foreground">보유자</span>
                      <span>{game.owner.displayName || game.owner.username}</span>
                    </div>
                  )}
                  {game.recommendedPlayers && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="w-20 font-medium text-foreground">추천 인원</span>
                      <span>{game.recommendedPlayers}</span>
                    </div>
                  )}
                  {game.playTime && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="w-20 font-medium text-foreground">플레이 시간</span>
                      <span>{game.playTime}</span>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

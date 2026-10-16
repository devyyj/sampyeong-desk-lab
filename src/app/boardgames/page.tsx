import { db } from "@/db";
import { boardGames } from "../../../drizzle/schema";
import { asc, desc } from "drizzle-orm";
import { getSession } from "@/lib/session";
import Link from "next/link";
import Form from "next/form";
import TopBar, { TopBarAction } from "@/components/TopBar";
import EmptyState from "@/components/EmptyState";
import CategorySheet from "@/components/CategorySheet";
import { chipClass } from "@/lib/chip";
import BoardGameList, { type BoardGameItem } from "@/components/BoardGameList";
import { CloseIcon, PlusIcon, SearchIcon } from "@/components/icons";

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
  // 카테고리 시트에서 자주 쓰는(게임이 많은) 분류를 먼저 찾도록 개수 많은 순, 같으면 가나다순. 미분류는 맨 뒤.
  const categories = [...categoryCounts.entries()].sort(([a, countA], [b, countB]) => {
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return countB - countA || a.localeCompare(b, 'ko');
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
  ];
  const categoryLinks = categories.map(([name, count]) => ({
    label: name,
    count,
    href: href({ category: name, q: query }),
    active: category === name,
  }));

  // 클라이언트 목록에 넘길 값. 보유자 실명은 회원일 때만 담는다(비회원 HTML에 실명이 실리지 않게).
  const items: BoardGameItem[] = games.map((game) => ({
    id: game.id,
    name: game.name,
    category: categoryOf(game),
    recommendedPlayers: game.recommendedPlayers,
    playTime: game.playTime,
    inSharedCabinet: game.inSharedCabinet,
    thumbnailUrl: game.thumbnailUrl,
    ownerName: session && game.owner ? game.owner.displayName || game.owner.nickname : null,
  }));

  return (
    <div>
      <TopBar
        title="보드게임"
        actions={
          session && (
            <TopBarAction href="/boardgames/add" label="보드게임 등록">
              <PlusIcon size={24} />
            </TopBarAction>
          )
        }
      />

      {allGames.length > 0 && (
        <div className="sticky top-12 lg:top-0 z-10 -mx-4 px-4 pt-3 pb-2 bg-background/95 backdrop-blur space-y-2.5">
          {/* GET 폼이라 검색 결과도 ?q= 주소로 남아 공유·뒤로 가기가 된다. next/form이라 전체 새로고침 없이 이동한다. */}
          <Form action="/boardgames" role="search" className="relative flex items-center">
            {cabinetOnly && <input type="hidden" name="cabinet" value="1" />}
            {category && <input type="hidden" name="category" value={category} />}
            <SearchIcon size={18} className="absolute left-3 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              aria-label="보드게임 검색"
              enterKeyHint="search"
              // 보유자는 회원에게만 보이므로 검색 대상도 회원에게만 넓힌다.
              placeholder={session ? '게임 이름 또는 보유자' : '게임 이름'}
              // 16px: iOS Safari가 초점 시 화면을 확대하지 않게 한다.
              className="w-full h-10 pl-9 pr-10 rounded-xl bg-muted text-[16px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            {query && (
              <Link
                href={href({ cabinet: cabinetOnly ? '1' : undefined, category })}
                aria-label="검색 지우기"
                className="absolute right-1 w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground"
              >
                <CloseIcon size={18} />
              </Link>
            )}
          </Form>

          <nav aria-label="보드게임 필터" className="flex gap-2">
            {filters.map((filter) => (
              <Link key={filter.href} href={filter.href} aria-current={filter.active ? 'page' : undefined} className={chipClass(filter.active)}>
                {filter.label}
              </Link>
            ))}
            <CategorySheet categories={categoryLinks} />
          </nav>
        </div>
      )}

      {allGames.length === 0 ? (
        <EmptyState title="등록된 보드게임이 없습니다." />
      ) : games.length === 0 ? (
        <EmptyState title="조건에 맞는 보드게임이 없습니다." description="검색어나 필터를 바꿔 보세요." />
      ) : (
        // 이미지 없이 한 게임당 두 줄: 이름·배지 / 카테고리·인원·시간·보유자. 누르면 상세 시트.
        <BoardGameList games={items} canEdit={Boolean(session)} />
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

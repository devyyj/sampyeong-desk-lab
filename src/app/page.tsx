import { getSession } from "@/lib/session";
import TopBar from "@/components/TopBar";
import FeedList from "@/components/FeedList";
import FeedFilterChips from "@/components/FeedFilterChips";
import { getActivityTypes, getFeedPage } from "@/lib/feed";
import { feedFilterHref, parseFeedFilter } from "@/lib/feed-filter";

export const dynamic = 'force-dynamic';

/**
 * 통합 피드(자유글 + 활동 기록). 설계: docs/superpowers/specs/2026-10-16-feed-activity-merge-design.md §5.2
 * 필터 칩(?kind=&type=)으로 종류를 고르고, 첫 페이지만 서버에서 그린 뒤 FeedList가 스크롤에 맞춰 이어 붙인다.
 * 예전 /activities 주소는 next.config 리디렉트로 /?kind=activity에 온다.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filter = parseFeedFilter(await searchParams);
  const session = await getSession();
  // 관리자 여부는 메뉴·댓글 삭제 버튼을 보여줄지 정하는 데만 쓴다. 실제 권한은 서버 액션이 DB로 다시 확인한다.
  const viewer = session ? { id: session.userId, isAdmin: session.isAdmin } : null;
  // 종류 칩은 활동 기록 필터에서만 보이므로 그때만 센다.
  const [firstPage, types] = await Promise.all([
    getFeedPage(filter, 0, viewer),
    filter.kind === 'activity' ? getActivityTypes() : Promise.resolve([]),
  ]);
  const here = feedFilterHref(filter);

  return (
    <div>
      <TopBar title="피드" />
      <FeedFilterChips filter={filter} types={types} />
      {/* 필터가 바뀌면 목록 상태(불러온 페이지·offset)를 새로 시작하도록 key를 필터 주소로 둔다. */}
      <FeedList
        key={here}
        filter={filter}
        initial={firstPage}
        viewer={viewer}
        loginHref={`/login?redirect=${encodeURIComponent(here)}`}
      />
    </div>
  );
}

import Link from "next/link";
import { getSession } from "@/lib/session";
import TopBar from "@/components/TopBar";
import ScreenTitle from "@/components/ScreenTitle";
import FeedList from "@/components/FeedList";
import { getFeedPage } from "@/lib/feed";
import { feedFilterHref, parseFeedFilter } from "@/lib/feed-filter";

export const dynamic = 'force-dynamic';

/**
 * 피드. 설계: docs/superpowers/specs/2026-10-17-unified-post-form-design.md §4.3
 * 필터 칩 없이 최신순으로 보여주고, 카드의 태그를 누르면 ?tag= 로 그 태그 글만 모아 본다.
 * 첫 페이지만 서버에서 그린 뒤 FeedList가 스크롤에 맞춰 이어 붙인다. 예전 /activities 주소는 next.config 리디렉트로 여기에 온다.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filter = parseFeedFilter(await searchParams);
  const session = await getSession();
  // 관리자 여부는 메뉴·댓글 삭제 버튼을 보여줄지 정하는 데만 쓴다. 실제 권한은 서버 액션이 DB로 다시 확인한다.
  const viewer = session ? { id: session.userId, isAdmin: session.isAdmin } : null;
  const firstPage = await getFeedPage(filter, 0, viewer);
  const here = feedFilterHref(filter);

  return (
    <div>
      {filter.tag ? (
        // 태그 모아 보기: 제목 줄에 태그를 보여주고 전체 피드로 돌아가는 링크를 둔다.
        <TopBar
          title={`#${filter.tag}`}
          backHref="/"
          backLabel="전체 피드로 돌아가기"
          actions={
            <Link href="/" className="px-3 h-9 inline-flex items-center rounded-full text-sm text-muted-foreground hover:bg-muted">
              전체 보기
            </Link>
          }
        />
      ) : (
        <ScreenTitle title="피드" />
      )}
      {/* 태그가 바뀌면 목록 상태(불러온 페이지·offset)를 새로 시작하도록 key를 주소로 둔다. */}
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

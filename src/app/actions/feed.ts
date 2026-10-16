'use server';

import { getFeedPage, type FeedPage } from '@/lib/feed';
import { parseFeedFilter, type FeedFilter } from '@/lib/feed-filter';
import { getSession } from '@/lib/session';

// 터무니없이 큰 offset으로 DB를 헛돌게 하지 않도록 상한을 둔다(글은 수백 건 수준).
const MAX_OFFSET = 100_000;

/**
 * 통합 피드 무한 스크롤의 다음 페이지. 피드는 비회원도 보는 공개 화면이라 로그인을 요구하지 않는다.
 * 활동 사진 URL을 발급할지는 클라이언트가 보낸 값이 아니라 세션으로 정한다(getFeedPage가 비회원이면 발급하지 않음).
 * 서버 액션은 누구나 직접 호출할 수 있으므로 필터와 offset을 다시 검사한다.
 */
export async function loadMoreFeed(filter: FeedFilter, offset: number): Promise<FeedPage> {
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) return { items: [], hasMore: false };
  const safe = parseFeedFilter({ kind: String(filter?.kind ?? ''), type: String(filter?.type ?? '') });
  const session = await getSession();
  return getFeedPage(safe, offset, session ? { id: session.userId, isAdmin: session.isAdmin } : null);
}

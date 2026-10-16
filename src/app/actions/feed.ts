'use server';

import { getFeedPage, getPostView, type FeedItem, type FeedPage } from '@/lib/feed';
import { isUuid } from '@/lib/uuid';
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
  const safe = parseFeedFilter({ tag: String(filter?.tag ?? '') });
  const session = await getSession();
  return getFeedPage(safe, offset, session ? { id: session.userId, isAdmin: session.isAdmin } : null);
}

/**
 * 카드 한 장을 다시 받는다(댓글을 달거나 고치거나 지운 뒤). 무한 스크롤 목록은 클라이언트 상태라
 * revalidatePath로 서버가 첫 페이지를 다시 그려도 목록에 반영되지 않으므로, 바뀐 카드만 바꿔 끼운다.
 * 지워졌으면 null(목록에서 뺀다). 보는 회원은 세션으로 정한다(활동 사진 서명 여부).
 */
export async function loadFeedItem(id: string): Promise<FeedItem | null> {
  if (!isUuid(id)) return null;
  const session = await getSession();
  return getPostView(id, session ? { id: session.userId, isAdmin: session.isAdmin } : null);
}

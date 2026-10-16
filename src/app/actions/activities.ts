'use server';

import { getActivityPage, type ActivityPage } from '@/lib/activity-list';

// 터무니없이 큰 offset으로 DB를 헛돌게 하지 않도록 상한을 둔다(활동은 수백 건 수준).
const MAX_OFFSET = 100_000;

/**
 * 활동 기록 무한 스크롤의 다음 페이지. 활동 목록은 비회원도 보는 공개 페이지라 로그인을 요구하지 않는다
 * (사진 URL은 싣지 않는다). 서버 액션은 누구나 직접 호출할 수 있으므로 offset을 검사한다.
 */
export async function loadMoreActivities(offset: number): Promise<ActivityPage> {
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) return { items: [], hasMore: false };
  return getActivityPage(offset);
}

import { asc, count, desc } from 'drizzle-orm';
import { db } from '@/db';
import { activities } from '../../drizzle/schema';
import { getActivityType } from './activity-types';
import { getCommentCounts, getLikeSummaries } from './community';

/*
 * 활동 기록 목록(무한 스크롤) 데이터. 첫 페이지는 서버 컴포넌트가, 다음 페이지부터는 서버 액션
 * (loadMoreActivities)이 같은 함수로 가져와 두 경로의 정렬·모양이 어긋나지 않게 한다.
 */

export const ACTIVITY_PAGE_SIZE = 20;

/** 클라이언트 컴포넌트로 넘기는 활동 한 줄. 사진 URL은 싣지 않고 개수만 보낸다(사진은 상세에서 회원에게만). */
export type ActivityListItem = {
  id: string;
  seasonId: number;
  date: string;
  type: string;
  title: string;
  photoCount: number;
  likeCount: number;
  commentCount: number;
};

export type ActivityPage = { items: ActivityListItem[]; hasMore: boolean };

/**
 * offset부터 한 페이지. 시즌 최신순 → 날짜 최신순으로 정렬한다. 시즌을 먼저 정렬해야 화면에서 시즌별로 묶을 때
 * 한 시즌이 두 덩어리로 갈라지지 않는다(날짜가 시즌 기간을 벗어난 기록이 있어도). id는 순서를 완전히 고정하려는 마지막 기준이다.
 * 다음 페이지가 있는지는 1개를 더 읽어서 판단한다(전체 수를 따로 세지 않음).
 * 활동은 드물게 추가되므로 커서 대신 offset을 쓴다. 스크롤 중 새 활동이 들어와 한 줄이 겹치면 화면에서 id로 걸러낸다.
 */
export async function getActivityPage(offset: number): Promise<ActivityPage> {
  const rows = await db.query.activities.findMany({
    orderBy: [desc(activities.seasonId), desc(activities.date), desc(activities.createdAt), asc(activities.id)],
    columns: { id: true, seasonId: true, date: true, type: true, title: true },
    with: { photos: { columns: { id: true } } },
    limit: ACTIVITY_PAGE_SIZE + 1,
    offset,
  });
  const page = rows.slice(0, ACTIVITY_PAGE_SIZE);

  // 이 페이지의 좋아요·댓글 수를 종류별로 한 번에 센다(N+1 방지).
  const ids = page.map((a) => a.id);
  const [likes, comments] = await Promise.all([getLikeSummaries('activity', ids, null), getCommentCounts('activity', ids)]);

  return {
    hasMore: rows.length > ACTIVITY_PAGE_SIZE,
    items: page.map((a) => ({
      id: a.id,
      seasonId: a.seasonId,
      date: a.date,
      type: a.type,
      title: a.title,
      photoCount: a.photos.length,
      likeCount: likes.get(a.id)?.count ?? 0,
      commentCount: comments.get(a.id) ?? 0,
    })),
  };
}

export type ActivityStats = {
  total: number;
  /** 시즌 id → 활동 수. 클라이언트로 넘기므로 Map 대신 일반 객체. */
  bySeason: Record<number, number>;
  /** [종류 화면 이름, 수], 많은 순 */
  byType: [string, number][];
};

/**
 * 머리말 요약과 시즌 제목 옆 건수. 목록을 끝까지 불러오지 않아도 전체 기준 숫자를 보여주려고
 * (시즌, 종류)별 개수를 한 번에 세서 나눠 담는다.
 */
export async function getActivityStats(): Promise<ActivityStats> {
  const rows = await db
    .select({ seasonId: activities.seasonId, type: activities.type, count: count() })
    .from(activities)
    .groupBy(activities.seasonId, activities.type);

  const bySeason: Record<number, number> = {};
  const typeCounts = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    total += row.count;
    bySeason[row.seasonId] = (bySeason[row.seasonId] ?? 0) + row.count;
    // 모르는 코드는 '기타'로 보이므로 화면 이름 기준으로 합친다.
    const { label } = getActivityType(row.type);
    typeCounts.set(label, (typeCounts.get(label) ?? 0) + row.count);
  }
  return { total, bySeason, byType: [...typeCounts.entries()].sort((a, b) => b[1] - a[1]) };
}

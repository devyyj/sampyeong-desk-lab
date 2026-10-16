import { asc, count, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { activityLikes, commentLikes, comments, postLikes } from '../../drizzle/schema';
import { getMemberBadges } from './member-badges';
import type { MemberBadge } from './badge';

/*
 * 좋아요·댓글 화면 데이터 조회. 피드·활동 목록처럼 대상이 여러 개인 화면에서도
 * 종류별로 쿼리 한 번씩만 돌도록 대상 id 목록을 받아 묶어서 가져온다(N+1 방지).
 */

/** 클라이언트 컴포넌트로 넘기는 댓글 한 개. 시간은 서버에서 문자열로 만들어 넘긴다(아래 formatKst). */
export type CommentView = {
  id: string;
  authorId: string;
  nickname: string;
  badge: MemberBadge | null;
  content: string;
  createdLabel: string;
  edited: boolean;
  likeCount: number;
  liked: boolean;
};

export type LikeSummary = { count: number; liked: boolean };

const LIKE_COLUMNS = {
  post: { table: postLikes, column: postLikes.postId },
  activity: { table: activityLikes, column: activityLikes.activityId },
  comment: { table: commentLikes, column: commentLikes.commentId },
} as const;

const COMMENT_COLUMNS = { post: comments.postId, activity: comments.activityId } as const;

/**
 * 한국 시간 "YYYY. MM. DD. HH:mm". 서버(Vercel은 UTC)와 브라우저의 시간대가 달라도 같은 문자열이 나오도록
 * 시간대를 고정한다. 클라이언트 컴포넌트가 직접 Date를 포맷하면 hydration 불일치가 난다.
 */
export function formatKst(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.year}. ${parts.month}. ${parts.day}. ${parts.hour}:${parts.minute}`;
}

/** 대상별 좋아요 수와 보는 회원이 눌렀는지. 좋아요가 없는 대상도 { 0, false }로 채운다. */
export async function getLikeSummaries(
  target: keyof typeof LIKE_COLUMNS,
  ids: string[],
  viewerId: string | null,
): Promise<Map<string, LikeSummary>> {
  const result = new Map<string, LikeSummary>(ids.map((id) => [id, { count: 0, liked: false }]));
  if (ids.length === 0) return result;

  const { table, column } = LIKE_COLUMNS[target];
  const rows = await db
    .select({
      targetId: column,
      count: count(),
      // 비회원이면 비교할 회원이 없으므로 항상 false.
      liked: viewerId ? sql<boolean>`bool_or(${table.userId} = ${viewerId})` : sql<boolean>`false`,
    })
    .from(table)
    .where(inArray(column, ids))
    .groupBy(column);
  for (const row of rows) result.set(row.targetId, { count: row.count, liked: Boolean(row.liked) });
  return result;
}

/** 대상별 댓글 수(활동 목록처럼 댓글 내용 없이 수만 필요한 화면용). */
export async function getCommentCounts(target: keyof typeof COMMENT_COLUMNS, ids: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>(ids.map((id) => [id, 0]));
  if (ids.length === 0) return result;
  const column = COMMENT_COLUMNS[target];
  const rows = await db.select({ targetId: column, count: count() }).from(comments).where(inArray(column, ids)).groupBy(column);
  for (const row of rows) if (row.targetId) result.set(row.targetId, row.count);
  return result;
}

/** 대상별 댓글 목록(오래된 순). 작성자는 닉네임만 싣는다(아이디·실명은 화면에 쓰지 않음). */
export async function getComments(
  target: keyof typeof COMMENT_COLUMNS,
  ids: string[],
  viewerId: string | null,
): Promise<Map<string, CommentView[]>> {
  const result = new Map<string, CommentView[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return result;

  const column = COMMENT_COLUMNS[target];
  const rows = await db.query.comments.findMany({
    where: inArray(column, ids),
    orderBy: [asc(comments.createdAt), asc(comments.id)],
    with: { author: { columns: { id: true, nickname: true } } },
  });
  const [badges, likes] = await Promise.all([
    getMemberBadges([...new Set(rows.map((c) => c.authorId))]),
    getLikeSummaries('comment', rows.map((c) => c.id), viewerId),
  ]);

  for (const c of rows) {
    const targetId = (target === 'post' ? c.postId : c.activityId)!;
    const like = likes.get(c.id) ?? { count: 0, liked: false };
    result.get(targetId)?.push({
      id: c.id,
      authorId: c.authorId,
      nickname: c.author.nickname,
      badge: badges.get(c.authorId) ?? null,
      content: c.content,
      createdLabel: formatKst(c.createdAt),
      // 작성 시 두 컬럼은 같은 문장의 DB now()라 값이 같고, 수정할 때만 updated_at이 바뀐다(updateComment도 DB now()).
      edited: c.updatedAt.getTime() !== c.createdAt.getTime(),
      likeCount: like.count,
      liked: like.liked,
    });
  }
  return result;
}

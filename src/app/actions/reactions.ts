'use server';

import { and, count, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { activityLikes, commentLikes, postLikes } from '../../../drizzle/schema';
import { getSession } from '@/lib/session';
import { isUuid } from '@/lib/uuid';
import { isForeignKeyViolation } from '@/lib/pg-errors';

export type LikeTarget = 'post' | 'activity' | 'comment';

/*
 * 대상별 좋아요 테이블. 진짜 FK + cascade를 걸 수 있도록 테이블을 나눴고(설계 §3.3),
 * 액션은 하나로 두고 target으로 테이블·컬럼을 고른다(세 액션의 규칙이 완전히 같아서).
 */
const LIKE_TABLES = {
  post: { table: postLikes, column: postLikes.postId, key: 'postId' },
  activity: { table: activityLikes, column: activityLikes.activityId, key: 'activityId' },
  comment: { table: commentLikes, column: commentLikes.commentId, key: 'commentId' },
} as const;

/**
 * 좋아요를 누르거나 취소한다. 결과(최종 상태와 개수)를 돌려줘 화면의 낙관적 표시를 확정한다.
 * - 먼저 지워 보고(이미 눌렀으면 취소), 지운 행이 없으면 추가한다. 연타·동시 요청으로 같은 행이 두 번 들어오려 하면
 *   PK 충돌을 ON CONFLICT DO NOTHING으로 흡수한다(오류 없이 "눌린 상태"로 수렴).
 * - 그 사이 대상이 삭제됐으면 추가가 FK 위반으로 실패하므로 "찾을 수 없습니다."로 알린다.
 */
export async function toggleLike(target: LikeTarget, id: string): Promise<{ liked: boolean; count: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: '로그인이 필요합니다.' };
  if (!Object.hasOwn(LIKE_TABLES, target) || !isUuid(id)) return { error: '잘못된 요청입니다.' };

  const { table, column, key } = LIKE_TABLES[target];
  try {
    const removed = await db.delete(table).where(and(eq(column, id), eq(table.userId, session.userId))).returning({ userId: table.userId });
    const liked = removed.length === 0;
    if (liked) {
      await db.insert(table).values({ [key]: id, userId: session.userId } as never).onConflictDoNothing();
    }
    const [{ count: total }] = await db.select({ count: count() }).from(table).where(eq(column, id));

    revalidateTarget(target, id);
    return { liked, count: total };
  } catch (e) {
    if (isForeignKeyViolation(e)) return { error: '찾을 수 없습니다.' };
    console.error('Toggle like error', e);
    return { error: '좋아요를 처리하지 못했습니다.' };
  }
}

/** 좋아요 수가 보이는 화면을 다시 그린다. 댓글은 게시글·활동 어느 쪽 댓글인지 모르므로 둘 다. */
function revalidateTarget(target: LikeTarget, id: string) {
  if (target === 'post') revalidatePath('/');
  if (target === 'activity') {
    revalidatePath(`/activities/${id}`);
    revalidatePath('/activities');
  }
  if (target === 'comment') {
    revalidatePath('/');
    revalidatePath('/activities', 'layout');
  }
}

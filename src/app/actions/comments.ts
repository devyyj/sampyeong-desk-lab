'use server';

import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { comments } from '../../../drizzle/schema';
import { getSession } from '@/lib/session';
import { getAdminUser } from '@/lib/admin';
import { isUuid } from '@/lib/uuid';
import { isForeignKeyViolation } from '@/lib/pg-errors';

export type CommentActionState = { ok: true } | { error: string } | null;

const MAX_COMMENT_LENGTH = 1000;
const BAD_REQUEST = { error: '잘못된 요청입니다.' };
const LOGIN_REQUIRED = { error: '로그인이 필요합니다.' };
const NOT_FOUND = { error: '찾을 수 없습니다.' };

/** 공백을 지운 뒤 1~1000자(글자 수 기준)면 그 내용을, 아니면 null. 마크다운이 아닌 일반 텍스트로 저장한다. */
function cleanContent(raw: FormDataEntryValue | null): string | null {
  const content = String(raw ?? '').trim();
  const length = [...content].length;
  return length >= 1 && length <= MAX_COMMENT_LENGTH ? content : null;
}
const CONTENT_ERROR = { error: `댓글은 1~${MAX_COMMENT_LENGTH}자로 입력해주세요.` };

/** 댓글이 보이는 화면을 다시 그린다(게시글 댓글은 피드, 활동 댓글은 활동 상세·목록의 댓글 수). */
function revalidateFor(target: { postId: string | null; activityId: string | null }) {
  if (target.postId) revalidatePath('/');
  if (target.activityId) {
    revalidatePath(`/activities/${target.activityId}`);
    revalidatePath('/activities');
  }
}

/** 게시글 또는 활동 기록에 댓글을 단다. 회원만 가능하다. */
export async function addComment(prevState: unknown, formData: FormData): Promise<CommentActionState> {
  const session = await getSession();
  if (!session) return LOGIN_REQUIRED;

  const target = formData.get('target');
  const targetId = formData.get('targetId');
  if ((target !== 'post' && target !== 'activity') || !isUuid(targetId)) return BAD_REQUEST;
  const content = cleanContent(formData.get('content'));
  if (!content) return CONTENT_ERROR;

  // 게시글·활동 중 정확히 하나만 채운다(DB CHECK comments_one_target이 최종 보장).
  const ref = target === 'post' ? { postId: targetId, activityId: null } : { postId: null, activityId: targetId };
  try {
    await db.insert(comments).values({
      ...(target === 'post' ? { postId: targetId } : { activityId: targetId }),
      authorId: session.userId,
      content,
    });
  } catch (e) {
    // 댓글을 쓰는 사이 글/활동이 삭제됐으면 FK 위반이 난다.
    if (isForeignKeyViolation(e)) return NOT_FOUND;
    console.error('Add comment error', e);
    return { error: '댓글을 저장하지 못했습니다.' };
  }
  revalidateFor(ref);
  return { ok: true };
}

/** 본인 댓글만 수정한다. 관리자도 남의 댓글은 고칠 수 없다(삭제만 가능, 설계 §2). */
export async function updateComment(prevState: unknown, formData: FormData): Promise<CommentActionState> {
  const session = await getSession();
  if (!session) return LOGIN_REQUIRED;

  const id = formData.get('id');
  if (!isUuid(id)) return BAD_REQUEST;
  const content = cleanContent(formData.get('content'));
  if (!content) return CONTENT_ERROR;

  try {
    const comment = await db.query.comments.findFirst({ where: eq(comments.id, id) });
    if (!comment) return NOT_FOUND;
    if (comment.authorId !== session.userId) return { error: '수정 권한이 없습니다.' };
    // 수정 시각도 DB 시계(now())로 남긴다. created_at이 DB now()라 앱 서버 시계와 어긋나면 "(수정됨)" 판정이 틀어진다.
    await db.update(comments).set({ content, updatedAt: sql`now()` }).where(eq(comments.id, comment.id));
    revalidateFor(comment);
    return { ok: true };
  } catch (e) {
    console.error('Update comment error', e);
    return { error: '댓글을 수정하지 못했습니다.' };
  }
}

/**
 * 댓글 삭제: 작성자 본인 또는 관리자. 관리자 여부는 세션 값이 아니라 getAdminUser로 DB를 다시 확인한다
 * (관리자 해제가 즉시 반영되도록). 댓글 좋아요는 FK cascade로 함께 지워진다.
 */
export async function deleteComment(id: string): Promise<CommentActionState> {
  const session = await getSession();
  if (!session) return LOGIN_REQUIRED;
  if (!isUuid(id)) return BAD_REQUEST;

  try {
    const comment = await db.query.comments.findFirst({ where: eq(comments.id, id) });
    if (!comment) return NOT_FOUND;
    if (comment.authorId !== session.userId && !(await getAdminUser())) return { error: '삭제 권한이 없습니다.' };
    await db.delete(comments).where(eq(comments.id, comment.id));
    revalidateFor(comment);
    return { ok: true };
  } catch (e) {
    console.error('Delete comment error', e);
    return { error: '댓글을 삭제하지 못했습니다.' };
  }
}

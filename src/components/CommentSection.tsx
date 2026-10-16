'use client';

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { addComment, updateComment, deleteComment, type CommentActionState } from '@/app/actions/comments';
import type { CommentView } from '@/lib/community';
import UserName from './UserName';
import LikeButton from './LikeButton';

type Viewer = { id: string; isAdmin: boolean } | null;

const inputClass =
  'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none';

/**
 * 게시글·활동 기록 공용 댓글 영역: 목록(오래된 순) + 작성 폼.
 * 권한 규칙(설계 §2): 회원만 작성, 본인은 수정·삭제, 관리자는 남의 댓글 삭제만. 버튼을 감추는 것은 화면 편의이고,
 * 실제 권한은 각 Server Action이 서버에서 다시 확인한다.
 * 저장·삭제 후의 목록 갱신은 액션의 revalidatePath가 서버 데이터를 다시 내려 주는 것으로 처리한다.
 */
export default function CommentSection({
  target,
  targetId,
  comments,
  viewer,
  loginHref,
}: {
  target: 'post' | 'activity';
  targetId: string;
  comments: CommentView[];
  viewer: Viewer;
  loginHref: string;
}) {
  return (
    <section aria-label="댓글" className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{viewer ? '첫 댓글을 남겨보세요.' : '아직 댓글이 없습니다.'}</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} viewer={viewer} />
          ))}
        </ul>
      )}

      {viewer ? (
        <NewCommentForm target={target} targetId={targetId} />
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href={loginHref} className="font-semibold text-foreground hover:underline">
            로그인
          </Link>
          하면 댓글을 쓸 수 있습니다.
        </p>
      )}
    </section>
  );
}

function NewCommentForm({ target, targetId }: { target: 'post' | 'activity'; targetId: string }) {
  const [state, formAction, isPending] = useActionState<CommentActionState, FormData>(addComment, null);
  const formRef = useRef<HTMLFormElement>(null);
  // 저장에 성공하면 입력란을 비운다. 실패하면 쓴 내용을 남겨 다시 시도할 수 있게 한다.
  useEffect(() => {
    if (state && 'ok' in state) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      // form action은 성공·실패와 관계없이 제출 후 입력을 초기화하므로, 직접 FormData를 넘겨 실패 시 입력을 지킨다.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-2"
    >
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="targetId" value={targetId} />
      <textarea name="content" aria-label="댓글 쓰기" required maxLength={1000} rows={2} placeholder="댓글을 입력하세요" className={inputClass} />
      {state && 'error' in state && <p className="text-sm text-red-500">{state.error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-1.5 bg-foreground text-background rounded-full text-sm font-semibold hover:bg-foreground/90 disabled:opacity-60"
        >
          댓글 달기
        </button>
      </div>
    </form>
  );
}

function CommentItem({ comment, viewer }: { comment: CommentView; viewer: Viewer }) {
  const isMine = viewer?.id === comment.authorId;
  const canDelete = isMine || Boolean(viewer?.isAdmin);
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const onDelete = () => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;
    startDelete(async () => {
      const result = await deleteComment(comment.id);
      if (result && 'error' in result) setDeleteError(result.error);
    });
  };

  return (
    <li className="rounded-xl bg-muted/50 px-3 py-2 space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <UserName userId={comment.authorId} nickname={comment.nickname} badge={comment.badge} />
        <span className="text-xs text-muted-foreground tabular-nums">
          {comment.createdLabel}
          {comment.edited && ' (수정됨)'}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {isMine && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:underline">
              수정
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={onDelete} disabled={isDeleting} className="text-xs text-red-500 hover:underline">
              삭제
            </button>
          )}
        </span>
      </div>

      {editing ? (
        <EditCommentForm comment={comment} onDone={() => setEditing(false)} />
      ) : (
        // 일반 텍스트로 보여준다(마크다운·HTML 아님). 줄바꿈은 살린다.
        <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
      )}
      {deleteError && <p role="alert" className="text-xs text-red-500">{deleteError}</p>}

      <LikeButton target="comment" id={comment.id} liked={comment.liked} count={comment.likeCount} canLike={viewer !== null} />
    </li>
  );
}

function EditCommentForm({ comment, onDone }: { comment: CommentView; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState<CommentActionState, FormData>(updateComment, null);
  useEffect(() => {
    if (state && 'ok' in state) onDone();
  }, [state, onDone]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={comment.id} />
      <textarea name="content" aria-label="댓글 수정" required maxLength={1000} rows={2} defaultValue={comment.content} className={inputClass} />
      {state && 'error' in state && <p className="text-sm text-red-500">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="px-3 py-1 rounded-full text-sm hover:bg-muted">
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-1 bg-foreground text-background rounded-full text-sm font-semibold disabled:opacity-60"
        >
          저장
        </button>
      </div>
    </form>
  );
}

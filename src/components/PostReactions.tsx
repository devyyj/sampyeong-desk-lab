'use client';

import { useId, useState } from 'react';
import type { CommentView } from '@/lib/community';
import LikeButton from './LikeButton';
import CommentSection from './CommentSection';

/**
 * 피드 게시글 아래의 ❤·💬 줄. 댓글은 피드를 길게 만들지 않도록 접어 두고 💬를 누르면 그 자리에서 펼친다.
 * 댓글 데이터는 피드를 그릴 때 함께 받아 둔다(동호회 규모라 충분히 작고, 펼칠 때 기다리지 않아도 된다).
 */
export default function PostReactions({
  postId,
  liked,
  likeCount,
  comments,
  viewer,
  loginHref,
}: {
  postId: string;
  liked: boolean;
  likeCount: number;
  comments: CommentView[];
  viewer: { id: string; isAdmin: boolean } | null;
  loginHref: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <LikeButton target="post" id={postId} liked={liked} count={likeCount} canLike={viewer !== null} />
        <button
          type="button"
          aria-label={`댓글 ${comments.length}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm text-muted-foreground hover:bg-muted"
        >
          <span aria-hidden="true">💬</span>
          <span className="tabular-nums">{comments.length}</span>
        </button>
      </div>
      {open && (
        <div id={panelId}>
          <CommentSection target="post" targetId={postId} comments={comments} viewer={viewer} loginHref={loginHref} />
        </div>
      )}
    </div>
  );
}

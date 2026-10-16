'use client';

import { useState, type ReactNode } from 'react';
import type { CommentView } from '@/lib/community';
import LikeButton from './LikeButton';
import CommentSection from './CommentSection';
import BottomSheet from './BottomSheet';
import { CommentIcon } from './icons';

/**
 * 피드 게시글의 반응 영역(인스타그램 배치): ♡ 💬 버튼 줄 → 본문(children) → "댓글 N개 모두 보기".
 * 댓글은 피드를 길게 만들지 않도록 카드 안에 펼치지 않고 바텀시트로 연다.
 * 댓글 데이터는 피드를 그릴 때 함께 받아 둔다(동호회 규모라 충분히 작고, 열 때 기다리지 않아도 된다).
 */
export default function PostReactions({
  postId,
  liked,
  likeCount,
  comments,
  viewer,
  loginHref,
  children,
}: {
  postId: string;
  liked: boolean;
  likeCount: number;
  comments: CommentView[];
  viewer: { id: string; isAdmin: boolean } | null;
  loginHref: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const count = comments.length;

  return (
    <div>
      <div className="flex items-center gap-1 -ml-2">
        <LikeButton target="post" id={postId} liked={liked} count={likeCount} canLike={viewer !== null} />
        <button
          type="button"
          aria-label={`댓글 ${count}`}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 h-10 px-2 rounded-full text-[15px] hover:bg-muted"
        >
          <CommentIcon size={24} />
          <span className="tabular-nums font-medium">{count}</span>
        </button>
      </div>

      {children && <div className="mt-1">{children}</div>}

      {count > 0 && (
        <button type="button" onClick={() => setOpen(true)} className="mt-1.5 text-sm text-muted-foreground">
          {`댓글 ${count}개 모두 보기`}
        </button>
      )}

      <BottomSheet open={open} title="댓글" onClose={() => setOpen(false)}>
        <CommentSection target="post" targetId={postId} comments={comments} viewer={viewer} loginHref={loginHref} />
      </BottomSheet>
    </div>
  );
}

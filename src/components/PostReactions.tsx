'use client';

import { useState, type ReactNode } from 'react';
import type { CommentView } from '@/lib/community';
import LikeButton from './LikeButton';
import CommentSection from './CommentSection';
import BottomSheet from './BottomSheet';
import { CommentIcon } from './icons';

/**
 * 피드 게시글의 반응 영역: ♡ 💬 버튼 줄 → 본문(children). 댓글은 💬 아이콘을 눌러 연다
 * (예전 "댓글 N개 모두 보기" 글자 줄은 같은 일을 하는 중복이라 뺐다).
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
  onChanged,
  children,
}: {
  postId: string;
  liked: boolean;
  likeCount: number;
  comments: CommentView[];
  viewer: { id: string; isAdmin: boolean } | null;
  loginHref: string;
  /** 댓글이 바뀐 뒤 부모(무한 스크롤 목록)가 이 글을 다시 받게 알린다. */
  onChanged?: () => void;
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
          className="inline-flex items-center gap-1.5 h-10 px-2 rounded-full text-[16px] hover:bg-muted"
        >
          <CommentIcon size={24} />
          <span className="tabular-nums font-medium">{count}</span>
        </button>
      </div>

      {children && <div className="mt-1">{children}</div>}

      <BottomSheet open={open} title="댓글" onClose={() => setOpen(false)}>
        <CommentSection target="post" targetId={postId} comments={comments} viewer={viewer} loginHref={loginHref} onChanged={onChanged} />
      </BottomSheet>
    </div>
  );
}

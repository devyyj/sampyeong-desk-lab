'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deletePost } from '@/app/actions/post';
import BottomSheet, { SheetAction } from './BottomSheet';
import { MoreIcon } from './icons';

/**
 * 게시글 카드 오른쪽 위 ··· 메뉴(작성자 본인과 관리자에게만 보인다). 수정·삭제를 바텀시트로 띄운다.
 * 예전 카드 머리의 작은 "수정/삭제" 글자 링크는 손가락으로 누르기 어려워 시트로 옮겼다.
 * 삭제 권한은 deletePost가 서버에서 작성자 본인·관리자인지 DB로 다시 확인한다.
 * 무한 스크롤 목록은 클라이언트 상태라 router.refresh()로는 카드가 빠지지 않으므로, 목록·상세는 onDeleted로 뒷처리를 맡긴다.
 */
export default function PostMenu({ postId, onDeleted }: { postId: string; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const router = useRouter();

  const onDelete = () => {
    if (!confirm('게시글을 삭제할까요?')) return;
    startDelete(async () => {
      await deletePost(postId);
      setOpen(false);
      if (onDeleted) onDeleted();
      else router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        aria-label="게시글 메뉴"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="w-10 h-10 -mr-2 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <MoreIcon size={22} />
      </button>
      <BottomSheet open={open} title="게시글" onClose={() => setOpen(false)}>
        <SheetAction href={`/posts/${postId}/edit`}>수정</SheetAction>
        <SheetAction danger onClick={onDelete} disabled={isDeleting}>
          {isDeleting ? '삭제하는 중…' : '삭제'}
        </SheetAction>
      </BottomSheet>
    </>
  );
}

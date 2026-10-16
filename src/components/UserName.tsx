'use client';

import { useCallback, useState } from 'react';
import { badgeLabel, type MemberBadge } from '@/lib/badge';
import ProfilePopup from './ProfilePopup';

/**
 * 게시글·댓글 작성자 표시. 아이디는 로그인에만 쓰므로 닉네임과 시즌 배지만 보여주고,
 * 누르면 프로필 팝업을 연다(팝업 내용은 그때 서버에서 받아 온다).
 */
export default function UserName({ userId, nickname, badge }: { userId: string; nickname: string; badge: MemberBadge | null }) {
  const [open, setOpen] = useState(false);
  // Overlay의 effect 의존성이라 렌더마다 새 함수가 되지 않게 고정한다.
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="font-semibold text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
      >
        {nickname}
        {/* 공백을 별도 텍스트로 두어 접근 가능한 이름이 "닉네임 [N시즌]"이 되게 한다. */}
        {badge && ' '}
        {badge && <span className="text-xs font-medium text-primary-600">{`[${badgeLabel(badge)}]`}</span>}
      </button>
      {open && <ProfilePopup userId={userId} nickname={nickname} onClose={close} />}
    </>
  );
}

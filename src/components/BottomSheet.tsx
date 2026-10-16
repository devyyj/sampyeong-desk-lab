'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import Overlay from './Overlay';
import { CloseIcon } from './icons';

/**
 * 화면 아래에서 올라오는 시트(모바일 앱의 action sheet / bottom sheet).
 * 댓글, 게시글 ··· 메뉴, 보드게임 카테고리·상세처럼 "지금 화면을 떠나지 않고 잠깐 보는 것"에 쓴다.
 * 넓은 화면(lg 이상)에서는 아래에 붙이지 않고 가운데 모달로 띄운다(마우스로 멀리 내려가지 않게).
 *
 * 열림 여부는 부모가 관리한다(controlled). 포커스 이동·트랩·복귀, ESC·배경 클릭 닫기는 Overlay가 한다.
 * 내용이 길면 시트 안쪽만 스크롤되고, 높이는 화면의 85%까지로 제한한다.
 */
export default function BottomSheet({
  open,
  title,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  /** 스크롤 영역 밖 하단에 고정할 내용(예: 댓글 입력창) */
  footer?: ReactNode;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <Overlay label={title} onClose={onClose} align="bottom" className="bg-black/40">
      <div
        className="w-full max-h-[85dvh] flex flex-col bg-background text-foreground rounded-t-3xl shadow-2xl
          pb-[env(safe-area-inset-bottom)] animate-[sheet-up_200ms_ease-out]
          lg:max-w-lg lg:rounded-3xl lg:pb-0"
      >
        {/* 손잡이 모양은 시트라는 신호일 뿐 드래그 기능은 없다(닫기는 버튼·배경·ESC). */}
        <div className="pt-2.5 pb-1 flex justify-center lg:hidden" aria-hidden="true">
          <span className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center gap-2 px-4 h-12 shrink-0">
          <h2 className="flex-1 text-[17px] font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-full hover:bg-muted"
          >
            <CloseIcon size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-border px-4 py-3">{footer}</div>}
      </div>
    </Overlay>
  );
}

/** 시트 안의 세로 메뉴 버튼(수정·삭제 같은 액션 목록용). */
export function SheetAction({
  children,
  onClick,
  href,
  danger,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  const className = `w-full h-12 flex items-center px-1 text-[16px] font-medium rounded-lg active:bg-muted disabled:opacity-50 ${
    danger ? 'text-red-600' : ''
  }`;
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

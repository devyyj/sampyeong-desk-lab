'use client';

import { useEffect, type ReactNode } from 'react';

/**
 * 화면 전체를 덮는 팝업 틀(사진 라이트박스·프로필 팝업 공용).
 * 네이티브 <dialog>.showModal()은 jsdom에서 지원되지 않아 단위 테스트가 어렵고 스타일 제어도 번거로워,
 * role="dialog" + aria-modal 오버레이를 직접 그린다. 닫기: ESC, 배경 클릭(안쪽 내용 클릭은 제외).
 * 닫기 버튼은 내용마다 위치가 달라 children 쪽에서 그린다.
 */
export default function Overlay({
  label,
  onClose,
  onKeyDown,
  className = 'bg-black/80',
  children,
}: {
  label: string;
  onClose: () => void;
  /** ESC 외의 키(예: 라이트박스의 ←/→)를 쓰는 경우 */
  onKeyDown?: (e: KeyboardEvent) => void;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else onKeyDown?.(e);
    };
    document.addEventListener('keydown', onKey);
    // 팝업이 떠 있는 동안 뒤의 페이지가 스크롤되지 않게 막는다.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onKeyDown]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      // 배경(오버레이 자신)을 눌렀을 때만 닫는다. 안쪽 요소 클릭은 target이 달라 닫히지 않는다.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${className}`}
    >
      {children}
    </div>
  );
}

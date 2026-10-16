'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * 지금 떠 있는 팝업들(먼저 연 것부터). 시트 위에 확인 팝업이 겹치는 경우처럼 여러 개가 함께 떠 있으면
 * 키(ESC·Tab)는 맨 위 팝업만 처리한다. 모두 document에 리스너를 달기 때문에, 이렇게 거르지 않으면
 * ESC 한 번에 확인 팝업과 그 아래 시트가 함께 닫힌다.
 */
const openStack: object[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 화면 전체를 덮는 팝업 틀(사진 라이트박스·프로필·바텀시트 공용).
 * 네이티브 <dialog>.showModal()은 jsdom에서 지원되지 않아 단위 테스트가 어렵고 스타일 제어도 번거로워,
 * role="dialog" + aria-modal 오버레이를 직접 그린다. 닫기: ESC, 배경 클릭(안쪽 내용 클릭은 제외).
 * 닫기 버튼은 내용마다 위치가 달라 children 쪽에서 그린다.
 *
 * aria-modal만으로는 키보드 포커스가 뒤 페이지로 빠져나가므로 직접 관리한다.
 * - 열릴 때: 안쪽 첫 포커스 요소(없으면 대화상자 자신)로 옮긴다.
 * - Tab/Shift+Tab: 안쪽 처음↔끝에서 돌게 한다(포커스 트랩).
 * - 닫힐 때: 열기 직전에 포커스가 있던 요소(보통 연 버튼)로 돌려준다.
 *
 * document.body로 포털한다. 조상 중에 backdrop-filter·transform이 있는 요소(예: 상단 바·sticky 필터 줄의 backdrop-blur)가
 * 있으면 position: fixed가 화면이 아니라 그 요소 기준이 되어, 시트가 그 줄 안에 갇혀 보이기 때문이다.
 * 팝업은 항상 사용자 동작(클릭) 뒤에만 그려지므로 서버 렌더에서는 이 컴포넌트가 실행되지 않는다.
 */
export default function Overlay({
  label,
  onClose,
  onKeyDown,
  className = 'bg-black/80',
  align = 'center',
  role = 'dialog',
  children,
}: {
  label: string;
  onClose: () => void;
  /** ESC·Tab 외의 키(예: 라이트박스의 ←/→)를 쓰는 경우 */
  onKeyDown?: (e: KeyboardEvent) => void;
  className?: string;
  /** bottom: 모바일에서 아래에 붙는 바텀시트(넓은 화면에서는 가운데) */
  align?: 'center' | 'bottom';
  /** alertdialog: 사용자의 답을 받아야 하는 확인 팝업(ConfirmDialog) */
  role?: 'dialog' | 'alertdialog';
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 최신 콜백을 ref로 들고 있어, 부모가 매 렌더 새 함수를 넘겨도 아래 effect(포커스 이동·복귀)가 다시 돌지 않게 한다.
  const handlers = useRef({ onClose, onKeyDown });
  useEffect(() => {
    handlers.current = { onClose, onKeyDown };
  });

  useEffect(() => {
    const root = ref.current;
    const token = {};
    openStack.push(token);
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => (root ? [...root.querySelectorAll<HTMLElement>(FOCUSABLE)] : []);
    (focusables()[0] ?? root)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        handlers.current.onClose();
        return;
      }
      if (e.key === 'Tab') {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        const inside = root?.contains(active);
        if (e.shiftKey && (active === first || !inside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !inside)) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      handlers.current.onKeyDown?.(e);
    };
    document.addEventListener('keydown', onKey);
    // 팝업이 떠 있는 동안 뒤의 페이지가 스크롤되지 않게 막는다.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      openStack.splice(openStack.indexOf(token), 1);
      document.body.style.overflow = prevOverflow;
      // 연 요소가 그사이 사라졌을 수도 있으므로(목록 갱신 등) 문서에 남아 있을 때만 돌려준다.
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const placement =
    align === 'bottom' ? 'items-end justify-center lg:items-center lg:p-4' : 'items-center justify-center p-4';

  return createPortal(
    <div
      ref={ref}
      role={role}
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      // 배경(오버레이 자신)을 눌렀을 때만 닫는다. 안쪽 요소 클릭은 target이 달라 닫히지 않는다.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-[100] flex outline-none ${placement} ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

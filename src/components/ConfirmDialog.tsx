'use client';

import { useCallback, useState, type ReactNode } from 'react';
import Overlay from './Overlay';

export type ConfirmOptions = {
  title: string;
  /** 제목 아래 보조 설명(예: "되돌릴 수 없어요.") */
  message?: string;
  /** 확정 버튼 글자. 기본 "확인". 삭제처럼 동작이 분명하면 그 동작 이름을 쓴다. */
  confirmLabel?: string;
  /** 삭제·탈퇴처럼 되돌릴 수 없는 동작이면 확정 버튼을 빨간색으로 */
  danger?: boolean;
  /** 확인 버튼 하나만 있는 안내 팝업(브라우저 alert 대신) */
  alertOnly?: boolean;
};

/**
 * 브라우저 기본 confirm()/alert() 대신 쓰는 앱 안의 확인 팝업.
 * 기본 대화상자는 모바일에서 사이트 주소가 함께 찍히고 앱 디자인과 동떨어져 보여서 직접 그린다.
 *
 * confirm()처럼 결과를 기다려 쓸 수 있도록 Promise를 돌려주는 훅으로 만들었다:
 *   const [confirm, dialog] = useConfirm();
 *   if (!(await confirm({ title: '삭제할까요?', danger: true }))) return;
 *   ...  return <>{...}{dialog}</>;
 * 전역 Provider를 두지 않고 쓰는 컴포넌트가 dialog를 직접 그린다(사용처가 몇 곳뿐이라 이 편이 단순하다).
 * 팝업은 Overlay가 body로 포털하므로 dialog를 어디에 두어도(시트 안이라도) 화면 맨 위에 뜬다.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const dialog = pending ? <ConfirmDialog {...pending} onConfirm={() => settle(true)} onCancel={() => settle(false)} /> : null;
  return [confirm, dialog];
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = '확인',
  danger = false,
  alertOnly = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  return (
    // 닫기(ESC·배경)는 "아니요"로 본다. alert 대신일 때는 확인과 같다(어차피 고를 것이 없다).
    <Overlay label={title} role="alertdialog" onClose={alertOnly ? onConfirm : onCancel} className="bg-black/40">
      <div className="w-full max-w-xs rounded-3xl bg-background text-foreground shadow-2xl p-5 animate-[sheet-up_150ms_ease-out]">
        <h2 className="text-[18px] font-bold tracking-tight text-center">{title}</h2>
        {message && <p className="mt-2 text-[15px] text-muted-foreground text-center whitespace-pre-line">{message}</p>}
        <div className="mt-5 flex gap-2">
          {/* 취소를 먼저 두어 Overlay가 첫 포커스를 취소에 준다(엔터 한 번에 삭제되지 않게). */}
          {!alertOnly && (
            <button type="button" onClick={onCancel} className="flex-1 h-11 rounded-full bg-muted text-[16px] font-semibold">
              취소
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 h-11 rounded-full text-[16px] font-semibold ${danger ? 'bg-red-600 text-white' : 'bg-foreground text-background'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

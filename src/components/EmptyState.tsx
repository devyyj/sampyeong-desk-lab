import type { ReactNode } from 'react';

/**
 * 목록이 비었거나 로그인이 필요할 때 화면 가운데에 띄우는 안내.
 * 예전의 테두리 카드 대신 여백만으로 두어 미니멀 톤에 맞춘다. action에는 로그인 버튼 등을 넣는다.
 */
export default function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="py-20 px-6 text-center flex flex-col items-center gap-2">
      <p className="text-[16px] font-semibold">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** EmptyState 등에서 쓰는 기본 버튼 모양(검정 알약). Link·button 어디에나 className으로 붙인다. */
export const primaryButtonClass =
  'inline-flex items-center justify-center h-11 px-6 rounded-full bg-foreground text-background text-[15px] font-semibold active:opacity-80';

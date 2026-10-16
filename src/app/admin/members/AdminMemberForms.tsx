'use client';

import { useActionState } from 'react';
import { resetMemberPin } from '@/app/actions/admin';

type Result = { error: string } | { success: string } | null;

function Message({ state }: { state: Result }) {
  if (!state) return null;
  return 'error' in state
    ? <p className="text-sm text-red-500 font-medium">{state.error}</p>
    : <p className="text-sm text-green-600 font-medium">{state.success}</p>;
}

/** 회원 한 명의 PIN 초기화 폼. 받은 회원은 다음 로그인 때 PIN을 바꿔야 한다. */
export function ResetPinForm({ userId }: { userId: string }) {
  const [state, formAction] = useActionState(resetMemberPin, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input name="pin" aria-label="초기화할 PIN" maxLength={4} pattern="\d{4}" inputMode="numeric" placeholder="1234" className="w-20 h-9 px-2 rounded-lg bg-muted text-[16px]" />
      <button type="submit" className="h-9 px-3 rounded-full bg-foreground text-background text-xs font-semibold">
        PIN 초기화
      </button>
      <Message state={state} />
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { createMember, resetMemberPin } from '@/app/actions/admin';

type Result = { error: string } | { success: string } | null;

function Message({ state }: { state: Result }) {
  if (!state) return null;
  return 'error' in state
    ? <p className="text-sm text-red-500 font-medium">{state.error}</p>
    : <p className="text-sm text-green-600 font-medium">{state.success}</p>;
}

const inputClass =
  'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500';

/** 새 회원 계정 발급 폼. PIN을 비우면 기본 초기 PIN(1234)이 적용된다. */
export function CreateMemberForm() {
  const [state, formAction] = useActionState(createMember, null);

  return (
    <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* 아이디가 닉네임 최초값이 되므로 닉네임 길이(20자)에 맞춘다. 서버도 다시 검사한다. */}
      <input name="username" required maxLength={20} placeholder="아이디 (사내 ID)" className={inputClass} />
      <input name="displayName" required placeholder="이름" className={inputClass} />
      <input name="department" required placeholder="소속 부서(팀)" className={inputClass} />
      <input name="pin" maxLength={4} pattern="\d{4}" inputMode="numeric" placeholder="초기 PIN (비우면 1234)" className={inputClass} />
      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="submit" className="px-4 py-2 bg-foreground text-background rounded-full text-sm font-semibold hover:bg-foreground/90">
          회원 생성
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

/** 회원 한 명의 PIN 초기화 폼. 받은 회원은 다음 로그인 때 PIN을 바꿔야 한다. */
export function ResetPinForm({ userId }: { userId: string }) {
  const [state, formAction] = useActionState(resetMemberPin, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input name="pin" maxLength={4} pattern="\d{4}" inputMode="numeric" placeholder="1234" className="w-20 px-2 py-1 border border-border rounded-md bg-background text-sm" />
      <button type="submit" className="px-3 py-1 border border-border rounded-md text-xs font-medium hover:bg-muted">
        PIN 초기화
      </button>
      <Message state={state} />
    </form>
  );
}

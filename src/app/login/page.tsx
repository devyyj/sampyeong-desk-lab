'use client';

import { use, useActionState } from 'react';
import { login } from '@/app/actions/auth';
import TopBar from '@/components/TopBar';
import { LogoMark } from '@/components/Logo';
import { fieldError, fieldHint, fieldInput, fieldLabel, submitButton } from '@/lib/form-styles';

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  // Next 15+부터 searchParams는 Promise다. 동기로 읽으면 redirect가 항상 undefined가 되어
  // 로그인 후 원래 가려던 페이지가 아닌 "/"로 이동하므로, 클라이언트 페이지에서는 use()로 푼다.
  const { redirect } = use(searchParams);
  const [state, formAction] = useActionState(login, null as any);

  return (
    <div>
      <TopBar title="로그인" />
      <div className="pt-4 pb-6 flex flex-col items-center gap-3 text-center">
        <LogoMark size={56} />
        <p className="text-[16px] text-muted-foreground">SDL에 오신 것을 환영합니다!<br />아이디와 PIN을 입력해주세요.</p>
      </div>
      <div>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirect" value={redirect || '/'} />
          
          <div>
            <label htmlFor="username" className={fieldLabel}>
              아이디
            </label>
            <input
              type="text"
              id="username"
              name="username"
              autoCapitalize="none"
              autoComplete="username"
              required
              aria-describedby="username-hint"
              className={fieldInput}
              placeholder="아이디를 입력하세요"
            />
            {/* 계정은 사내 Ahnlab ACE 아이디로 발급되므로, 어떤 아이디를 넣어야 하는지 예시와 함께 안내한다. */}
            <p id="username-hint" className={fieldHint}>
              Ahnlab ACE 아이디를 입력해주세요. ex) youngyong.jo
            </p>
          </div>
          
          <div>
            <label htmlFor="pin" className={fieldLabel}>
              비밀번호 (4자리 PIN)
            </label>
            <input
              type="password"
              id="pin"
              name="pin"
              required
              maxLength={4}
              pattern="\d{4}"
              inputMode="numeric"
              className={fieldInput}
              placeholder="****"
            />
          </div>

          {state?.error && (
            <p role="alert" className={fieldError}>{state.error}</p>
          )}

          <div className="pt-2">
            <button type="submit" className={submitButton}>
              로그인
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-[14px] text-muted-foreground">계정은 관리자에게 문의하세요.</p>
      </div>
    </div>
  );
}

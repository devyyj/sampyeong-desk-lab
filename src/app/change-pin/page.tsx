'use client';

import { useActionState } from 'react';
import { changePin } from '@/app/actions/auth';
import TopBar from '@/components/TopBar';
import { fieldError, fieldInput, fieldLabel, submitButton } from '@/lib/form-styles';

// 관리자가 발급/초기화한 PIN으로 로그인한 사용자가 오는 화면.
// middleware(guardRoute)가 PIN을 바꾸기 전까지 다른 페이지 대신 이곳으로 보낸다.
export default function ChangePinPage() {
  const [state, formAction] = useActionState(changePin, null);

  return (
    <div>
      <TopBar title="초기 비밀번호를 변경해주세요" />
      <div>
        <p className="mb-6 text-[14px] text-muted-foreground">
          관리자가 발급한 비밀번호를 사용 중입니다. 본인만 아는 4자리 숫자로 바꿔야 서비스를 이용할 수 있습니다.
        </p>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="newPin" className={fieldLabel}>
              새 비밀번호 (4자리 PIN)
            </label>
            <input
              type="password"
              id="newPin"
              name="newPin"
              required
              maxLength={4}
              pattern="\d{4}"
              inputMode="numeric"
              className={fieldInput}
              placeholder="****"
            />
          </div>

          <div>
            <label htmlFor="confirmNewPin" className={fieldLabel}>
              새 비밀번호 확인
            </label>
            <input
              type="password"
              id="confirmNewPin"
              name="confirmNewPin"
              required
              maxLength={4}
              pattern="\d{4}"
              inputMode="numeric"
              className={fieldInput}
              placeholder="****"
            />
          </div>

          {state?.error && <p role="alert" className={fieldError}>{state.error}</p>}

          <div className="pt-2">
            <button type="submit" className={submitButton}>
              비밀번호 변경
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

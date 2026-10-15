'use client';

import { useActionState } from 'react';
import { changePin } from '@/app/actions/auth';

// 관리자가 발급/초기화한 PIN으로 로그인한 사용자가 오는 화면.
// middleware(guardRoute)가 PIN을 바꾸기 전까지 다른 페이지 대신 이곳으로 보낸다.
export default function ChangePinPage() {
  const [state, formAction] = useActionState(changePin, null);

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-card border border-border p-8 rounded-2xl shadow-sm">
        <h1 className="text-2xl font-bold mb-2 text-center text-primary-600">초기 비밀번호를 변경해주세요</h1>
        <p className="text-center text-muted-foreground mb-6 text-sm">
          관리자가 발급한 비밀번호를 사용 중입니다. 본인만 아는 4자리 숫자로 바꿔야 서비스를 이용할 수 있습니다.
        </p>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="newPin" className="block text-sm font-medium text-foreground mb-1">
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
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="****"
            />
          </div>

          <div>
            <label htmlFor="confirmNewPin" className="block text-sm font-medium text-foreground mb-1">
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
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="****"
            />
          </div>

          {state?.error && <p className="text-sm text-red-500 font-medium">{state.error}</p>}

          <button
            type="submit"
            className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            비밀번호 변경
          </button>
        </form>
      </div>
    </div>
  );
}

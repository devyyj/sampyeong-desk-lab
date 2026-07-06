'use client';

import { useActionState } from 'react';
import { signup } from '@/app/actions/auth';
import Link from 'next/link';

export default function SignupPage() {
  const [state, formAction] = useActionState(signup, null as any);

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-card border border-border p-8 rounded-2xl shadow-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-primary-600">SDL 회원가입</h1>
        
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
              아이디
            </label>
            <input
              type="text"
              id="username"
              name="username"
              required
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="사용할 아이디"
            />
          </div>

          <div>
            <label htmlFor="department" className="block text-sm font-medium text-foreground mb-1">
              소속 부서(팀)
            </label>
            <input
              type="text"
              id="department"
              name="department"
              required
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="예: 전략기획팀"
            />
          </div>
          
          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-foreground mb-1">
              비밀번호 (4자리 PIN)
            </label>
            <input
              type="password"
              id="pin"
              name="pin"
              required
              maxLength={4}
              pattern="\d{4}"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="숫자 4자리 입력"
            />
            <p className="text-xs text-muted-foreground mt-1">심리적 진입 장벽을 낮추기 위해 숫자 4자리만 사용합니다.</p>
          </div>

          {state?.error && (
            <p className="text-sm text-red-500 font-medium">{state.error}</p>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors mt-2"
          >
            가입하기
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-primary-600 hover:underline font-medium">
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}

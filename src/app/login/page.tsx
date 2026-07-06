'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';
import Link from 'next/link';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const [state, formAction] = useActionState(login, null as any);

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-card border border-border p-8 rounded-2xl shadow-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-primary-600">SDL 로그인</h1>
        
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirect" value={searchParams.redirect || '/'} />
          
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
              placeholder="아이디를 입력하세요"
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
              placeholder="****"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-500 font-medium">{state.error}</p>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            로그인
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-primary-600 hover:underline font-medium">
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}

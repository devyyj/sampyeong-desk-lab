'use client';

import { useActionState, useState } from 'react';
import { signup } from '@/app/actions/auth';
import Link from 'next/link';

export default function SignupPage() {
  const [state, formAction] = useActionState(signup, null as any);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const isPinMatched = pin === confirmPin;
  const isPinLengthValid = pin.length === 4;

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-card border border-border p-8 rounded-2xl shadow-sm">
        <h1 className="text-2xl font-bold mb-2 text-center text-primary-600">SDL 회원가입</h1>
        <p className="text-center text-muted-foreground mb-6 text-sm">사내 보드게임 문화를 함께 즐겨보세요!</p>
        
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
              placeholder="영문, 숫자 조합으로 입력해주세요"
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
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="숫자 4자리 입력"
            />
            <p className="text-xs text-muted-foreground mt-1">심리적 진입 장벽을 낮추기 위해 숫자 4자리만 사용합니다.</p>
          </div>

          <div>
            <label htmlFor="confirmPin" className="block text-sm font-medium text-foreground mb-1">
              비밀번호 확인
            </label>
            <input
              type="password"
              id="confirmPin"
              name="confirmPin"
              required
              maxLength={4}
              pattern="\d{4}"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 ${confirmPin && !isPinMatched ? 'border-red-500 focus:ring-red-500' : 'border-border focus:ring-primary-500'}`}
              placeholder="숫자 4자리를 다시 입력해주세요"
            />
            {confirmPin && !isPinMatched && (
              <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
            )}
            {confirmPin && isPinMatched && isPinLengthValid && (
              <p className="text-xs text-green-500 mt-1">비밀번호가 일치합니다.</p>
            )}
          </div>

          {state?.error && (
            <p className="text-sm text-red-500 font-medium">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={!isPinMatched || !isPinLengthValid}
            className={`w-full py-2.5 rounded-lg font-medium transition-colors mt-2 ${!isPinMatched || !isPinLengthValid ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-foreground text-background hover:bg-foreground/90'}`}
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

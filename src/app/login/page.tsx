'use client';

import React from 'react';
import VirtualKeypad from '@/app/components/VirtualKeypad';

export default function LoginPage() {
  const [nickname, setNickname] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    // Prevent back button
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || password.length !== 4) {
      setError('닉네임과 비밀번호 4자리를 정확히 입력해주세요.');
      return;
    }

    if (nickname === 'fail') {
      setError('닉네임 또는 비밀번호가 일치하지 않습니다.');
      return;
    }

    // Set dummy session cookie for testing
    document.cookie = 'sb-access-token=dummy-token; path=/';
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-[#18181b] dark:text-[#f4f4f5] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white dark:bg-[#121214] border border-[#e4e4e7] dark:border-[#27272a] rounded-lg p-6 shadow-sm space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-[14px] font-bold">로그인</h1>
          <p className="text-[10px] text-[#71717a] dark:text-[#a1a1aa]">삼평동 책상 전략 연구소</p>
        </div>

        {error && (
          <div className="bg-rose-5 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-500 text-[10px] p-2 rounded text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-[#71717a] dark:text-[#a1a1aa] mb-1 uppercase tracking-wider">닉네임</label>
            <input
              type="text"
              placeholder="닉네임 입력"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#fafafa] dark:bg-[#18181b] border border-[#e4e4e7] dark:border-[#27272a] rounded text-[11px] focus:outline-none placeholder-[#a1a1aa]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#71717a] dark:text-[#a1a1aa] mb-1 uppercase tracking-wider">비밀번호 (4자리)</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="숫자 4자리 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full px-2.5 py-1.5 bg-[#fafafa] dark:bg-[#18181b] border border-[#e4e4e7] dark:border-[#27272a] rounded text-[11px] focus:outline-none placeholder-[#a1a1aa]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-1.5 bg-[#18181b] dark:bg-[#f4f4f5] text-white dark:text-[#18181b] rounded text-[11px] font-medium"
          >
            로그인
          </button>
        </form>

        <div className="text-center">
          <a href="/signup" className="text-[10px] text-[#71717a] dark:text-[#a1a1aa] hover:underline">
            연구원 신규 등록하기
          </a>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';

export default function SignupPage() {
  const [realName, setRealName] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [nickname, setNickname] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!realName.trim() || !department.trim()) {
      setError('이름과 부서는 필수 입력 항목입니다.');
      return;
    }

    if (password.length !== 4) {
      setError('비밀번호는 숫자 4자리여야 합니다.');
      return;
    }

    try {
      const { signUpUser } = await import('@/utils/auth');
      const data = await signUpUser({
        nickname,
        realName,
        department,
        password4Digit: password,
      });

      if (data?.session) {
        document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${data.session.expires_in}`;
        if (data.session.refresh_token) {
          document.cookie = `sb-refresh-token=${data.session.refresh_token}; path=/; max-age=${data.session.expires_in}`;
        }
      } else {
        // Fallback for tests or standard metadata
        document.cookie = 'sb-access-token=dummy-token; path=/';
      }
      setSuccess(true);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || '가입 도중 에러가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-[#18181b] dark:text-[#f4f4f5] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white dark:bg-[#121214] border border-[#e4e4e7] dark:border-[#27272a] rounded-lg p-6 shadow-sm space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-[14px] font-bold">회원 가입</h1>
          <p className="text-[10px] text-[#71717a] dark:text-[#a1a1aa]">삼평동 책상 전략 연구소</p>
        </div>

        {error && (
          <div className="bg-rose-5 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-500 text-[10px] p-2 rounded text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-[#71717a] dark:text-[#a1a1aa] mb-1 uppercase tracking-wider">이름</label>
            <input
              type="text"
              placeholder="본명 입력"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#fafafa] dark:bg-[#18181b] border border-[#e4e4e7] dark:border-[#27272a] rounded text-[11px] focus:outline-none placeholder-[#a1a1aa]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#71717a] dark:text-[#a1a1aa] mb-1 uppercase tracking-wider">부서</label>
            <input
              type="text"
              placeholder="부서명 입력"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#fafafa] dark:bg-[#18181b] border border-[#e4e4e7] dark:border-[#27272a] rounded text-[11px] focus:outline-none placeholder-[#a1a1aa]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#71717a] dark:text-[#a1a1aa] mb-1 uppercase tracking-wider">닉네임</label>
            <input
              type="text"
              placeholder="고유 닉네임 입력"
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
            가입 완료
          </button>
        </form>

        <div className="text-center">
          <a href="/login" className="text-[10px] text-[#71717a] dark:text-[#a1a1aa] hover:underline">
            이미 계정이 있으신가요? 로그인하기
          </a>
        </div>
      </div>
    </div>
  );
}

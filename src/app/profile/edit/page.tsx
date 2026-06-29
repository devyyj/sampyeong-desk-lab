'use client';

import React from 'react';

export default function ProfileEditPage() {
  const [realName, setRealName] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [avatarUrl, setAvatarUrl] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Check if session token exists
    const cookies = typeof document !== 'undefined' ? document.cookie : '';
    const hasToken = cookies.includes('sb-access-token') || cookies.includes('supabase-session');

    if (!hasToken) {
      try {
        window.location.href = '/login';
      } catch (err) {
        // Fallback for JSDOM testing
      }
      return;
    }

    const loadProfileData = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.user) {
          setRealName(data.user.user_metadata?.real_name || '');
          setDepartment(data.user.user_metadata?.department || '');
          setBio(data.user.user_metadata?.bio || '');
          setAvatarUrl(data.user.user_metadata?.avatar_url || '');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(true);
    setTimeout(() => {
      window.location.href = '/profile';
    }, 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] flex items-center justify-center text-[11px] text-[#71717a] dark:text-[#a1a1aa]">
        인증 확인 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-[#18181b] dark:text-[#f4f4f5] pb-8 font-sans">
      <main className="max-w-md mx-auto px-4 mt-6">
        <div className="bg-white dark:bg-[#121214] border border-[#e4e4e7] dark:border-[#27272a] rounded-lg p-5 shadow-sm space-y-4">
          <h2 className="text-[14px] font-bold">프로필 편집</h2>

          {success && (
            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-indigo-500 text-[11px] p-2.5 rounded text-center">
              프로필이 저장되었습니다. 잠시 후 이동합니다...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#71717a] dark:text-[#a1a1aa] mb-1 uppercase tracking-wider">이름</label>
              <input
                type="text"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#fafafa] dark:bg-[#18181b] border border-[#e4e4e7] dark:border-[#27272a] rounded text-[11px] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#71717a] dark:text-[#a1a1aa] mb-1 uppercase tracking-wider">부서</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#fafafa] dark:bg-[#18181b] border border-[#e4e4e7] dark:border-[#27272a] rounded text-[11px] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#71717a] dark:text-[#a1a1aa] mb-1 uppercase tracking-wider">프로필 이미지 URL</label>
              <input
                type="text"
                placeholder="https://..."
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#fafafa] dark:bg-[#18181b] border border-[#e4e4e7] dark:border-[#27272a] rounded text-[11px] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#71717a] dark:text-[#a1a1aa] mb-1 uppercase tracking-wider">자기소개</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-2.5 py-1.5 bg-[#fafafa] dark:bg-[#18181b] border border-[#e4e4e7] dark:border-[#27272a] rounded text-[11px] focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.location.href = '/profile'}
                className="flex-1 py-1.5 bg-transparent border border-[#e4e4e7] dark:border-[#27272a] rounded text-[11px] font-medium"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 py-1.5 bg-[#18181b] dark:bg-[#f4f4f5] text-white dark:text-[#18181b] rounded text-[11px] font-medium"
              >
                저장
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

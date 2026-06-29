'use client';

import React from 'react';
import Link from 'next/link';
import { signOutUser } from '@/utils/auth';

export default function GlobalHeader() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  // Check if session cookies are present on mount and periodically
  const checkSession = () => {
    const cookies = typeof document !== 'undefined' ? document.cookie : '';
    const hasToken = cookies.includes('sb-access-token') || cookies.includes('supabase-session');
    setIsLoggedIn(hasToken);
  };

  React.useEffect(() => {
    checkSession();
    const interval = setInterval(checkSession, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (e) {
      console.error(e);
    }
    // Delete session cookies
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'supabase-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setIsLoggedIn(false);
    window.location.href = '/login';
  };

  return (
    <header className="sticky top-0 z-50 bg-[#fafafa]/90 dark:bg-[#09090b]/90 backdrop-blur border-b border-[#e4e4e7] dark:border-[#27272a]">
      <div className="max-w-xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/" className="font-bold text-xs uppercase tracking-wider cursor-pointer text-[#18181b] dark:text-[#f4f4f5] no-underline">
          SDL.Lab
        </Link>
        <nav className="flex items-center space-x-3 text-[11px] font-medium text-[#71717a] dark:text-[#a1a1aa]">
          <Link href="/" className="hover:text-[#18181b] dark:hover:text-[#f4f4f5] no-underline">피드</Link>
          <Link href="/directory" className="hover:text-[#18181b] dark:hover:text-[#f4f4f5] no-underline">명부</Link>
          <Link href="/profile" className="hover:text-[#18181b] dark:hover:text-[#f4f4f5] no-underline">프로필</Link>
          <Link href="/announcements" className="hover:text-[#18181b] dark:hover:text-[#f4f4f5] no-underline">공지</Link>
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="text-[10px] text-rose-500 hover:underline px-1 cursor-pointer"
            >
              로그아웃
            </button>
          ) : (
            <Link href="/login" className="text-[10px] text-[#18181b] dark:text-[#f4f4f5] hover:underline px-1">
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

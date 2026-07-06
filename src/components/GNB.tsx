'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function GNB({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();


  const navItems = [
    { name: '자유게시판', path: '/' },
    { name: '보드게임 현황', path: '/boardgames' },
    { name: '회원 목록', path: '/members' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border glass">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-xl text-primary-600 tracking-tight">
            SDL
          </Link>
          <nav className="hidden md:flex gap-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`text-sm font-medium transition-colors hover:text-primary-500 ${
                  pathname === item.path ? 'text-primary-600' : 'text-muted-foreground'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <>
              <Link href="/mypage" className="text-sm font-medium hover:text-primary-500">
                마이페이지
              </Link>
              <form action={async () => {
                const { logout } = await import('@/app/actions/auth');
                await logout();
              }}>
                <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  로그아웃
                </button>
              </form>

            </>
          ) : (

            <>
              <Link href="/login" className="text-sm font-medium hover:text-primary-500">
                로그인
              </Link>
              <Link href="/signup" className="text-sm font-medium px-4 py-2 bg-foreground text-background rounded-full hover:bg-foreground/90 transition-colors">
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

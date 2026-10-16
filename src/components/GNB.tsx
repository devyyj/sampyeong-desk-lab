'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { name: '자유게시판', path: '/' },
  { name: '활동 기록', path: '/activities' },
  { name: '보드게임', path: '/boardgames' },
  { name: '회원 명부', path: '/members' },
  // 동호회 안내는 /about/rules, /about/shared-cabinet 두 문서라, 메뉴는 첫 문서로 보내고 /about 전체를 현재 메뉴로 본다.
  { name: '동호회 안내', path: '/about/rules', match: '/about' },
];

/**
 * 하위 경로(/activities/123, /boardgames/add 등)에서도 상위 메뉴를 현재 메뉴로 표시한다.
 * '/'는 모든 경로의 접두사라 정확히 일치할 때만 자유게시판으로 본다.
 */
function isActive(pathname: string, item: (typeof NAV_ITEMS)[number]) {
  const base = item.match ?? item.path;
  if (base === '/') return pathname === '/';
  return pathname === base || pathname.startsWith(`${base}/`);
}

async function handleLogout() {
  const { logout } = await import('@/app/actions/auth');
  await logout();
}

export default function GNB({ isLoggedIn, isAdmin }: { isLoggedIn: boolean; isAdmin: boolean }) {
  const pathname = usePathname();
  // 모바일(md 미만)에서는 메뉴가 화면에 다 들어가지 않으므로 햄버거 버튼으로 여닫는 패널에 넣는다.
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  const accountButtonClass =
    'px-3 py-1.5 rounded-full border border-border text-sm font-medium whitespace-nowrap hover:bg-muted transition-colors';

  const navLinkClass = (active: boolean) =>
    `text-sm font-medium transition-colors hover:text-primary-500 ${active ? 'text-primary-600' : 'text-muted-foreground'}`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border glass">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-xl text-primary-600 tracking-tight" onClick={closeMobile}>
            SDL
          </Link>
          <nav aria-label="주요 메뉴" className="hidden md:flex gap-4">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link key={item.path} href={item.path} aria-current={active ? 'page' : undefined} className={navLinkClass(active)}>
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* 관리자 링크는 자주 쓰지 않으므로 데스크톱 헤더에만 두고, 모바일에서는 햄버거 패널에 둔다.
              표시 여부만 세션 값으로 정한다. 관리자 화면·액션은 서버에서 DB로 다시 권한을 확인한다. */}
          {isLoggedIn && isAdmin && (
            <Link href="/admin/members" className="hidden md:inline text-sm font-medium mr-2 hover:text-primary-500">
              관리자
            </Link>
          )}
          {/* 로그인 상태를 화면 크기와 상관없이 한눈에 알 수 있도록 계정 버튼은 항상 헤더에 버튼 형태로 보인다. */}
          <div role="group" aria-label="계정" className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <Link href="/mypage" onClick={closeMobile} className={accountButtonClass}>
                  마이페이지
                </Link>
                <form action={handleLogout}>
                  <button type="submit" className={accountButtonClass}>
                    로그아웃
                  </button>
                </form>
              </>
            ) : (
              <Link href="/login" onClick={closeMobile} className={`${accountButtonClass} bg-foreground text-background border-foreground hover:bg-foreground/90`}>
                로그인
              </Link>
            )}
          </div>
          <button
            type="button"
            className="md:hidden p-2 -mr-2 ml-1 rounded-lg hover:bg-muted"
            aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id="mobile-menu" aria-label="모바일 메뉴" className="md:hidden border-t border-border bg-background px-4 py-3">
          <ul className="flex flex-col">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    aria-current={active ? 'page' : undefined}
                    onClick={closeMobile}
                    className={`block py-2.5 ${navLinkClass(active)}`}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
          {/* 계정 버튼은 헤더에 항상 있으므로, 패널에는 데스크톱에서만 보이는 관리자 링크만 둔다. */}
          {isLoggedIn && isAdmin && (
            <div className="mt-2 pt-3 border-t border-border">
              <Link href="/admin/members" onClick={closeMobile} className="text-sm font-medium hover:text-primary-500">
                관리자
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}

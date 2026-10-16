'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hidesAppChrome } from '@/lib/nav';
import Logo from './Logo';

/**
 * 모든 화면 맨 위에 고정되는 로고 헤더(모바일). 로고를 누르면 피드(/)로 간다.
 * 넓은 화면(lg 이상)에서는 왼쪽 레일 위쪽에 같은 로고가 있으므로 숨긴다.
 * 화면별 제목(TopBar)은 이 헤더 아래에서 함께 스크롤되고, 시즌 제목·검색 줄 같은 sticky 요소는 이 헤더 높이(top-12) 아래에 붙는다.
 * 글쓰기·수정(전체 화면 작성 모드)에서는 작성 화면 자체의 상단 바(취소|게시)를 쓰므로 숨긴다.
 */
export default function AppHeader() {
  const pathname = usePathname();
  if (hidesAppChrome(pathname)) return null;

  return (
    <header className="sticky top-0 z-40 lg:hidden bg-background/95 backdrop-blur border-b border-border/60">
      <div className="max-w-[640px] mx-auto h-12 px-4 flex items-center">
        <Link href="/" aria-label="SDL 삼평동 책상 전략 연구소 홈" className="py-1">
          <Logo />
        </Link>
      </div>
    </header>
  );
}

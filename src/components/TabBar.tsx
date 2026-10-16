'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { TABS, activeTabOf, hidesAppChrome, type TabKey } from '@/lib/nav';
import { CalendarIcon, DiceIcon, HomeIcon, UserIcon, UsersIcon } from './icons';
import Logo from './Logo';

const ICONS: Record<TabKey, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  feed: HomeIcon,
  activities: CalendarIcon,
  boardgames: DiceIcon,
  members: UsersIcon,
  my: UserIcon,
};

/**
 * 주요 메뉴. 모바일에서는 화면 아래 고정 탭바, 넓은 화면(lg 이상)에서는 왼쪽 세로 레일이다.
 * 같은 링크를 두 벌 그리지 않고 하나의 <nav>를 CSS로만 배치를 바꿔, 스크린 리더에도 메뉴가 한 번만 읽힌다.
 * 아이폰 홈 인디케이터에 가리지 않도록 safe-area 만큼 아래 여백을 더한다(layout의 viewport-fit=cover 필요).
 */
export default function TabBar() {
  const pathname = usePathname();
  if (hidesAppChrome(pathname)) return null;
  const active = activeTabOf(pathname);

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed z-40 bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]
        lg:inset-x-auto lg:left-0 lg:top-0 lg:bottom-0 lg:w-56 lg:border-t-0 lg:border-r lg:pb-0 lg:pt-6 lg:px-3"
    >
      {/* 레일 위쪽 로고(넓은 화면에서는 모바일 로고 헤더 대신 여기 보인다). 바로 아래 '피드' 탭이 같은 곳(/)으로 가므로 링크로 중복시키지 않는다. */}
      <p className="hidden lg:block px-3 pb-7" aria-hidden="true">
        <Logo />
      </p>
      <ul className="flex lg:flex-col lg:gap-1">
        {TABS.map((tab) => {
          const Icon = ICONS[tab.key];
          const current = active?.key === tab.key;
          return (
            <li key={tab.key} className="flex-1 lg:flex-none">
              <Link
                href={tab.href}
                aria-current={current ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] transition-colors
                  lg:flex-row lg:justify-start lg:gap-3 lg:h-12 lg:px-3 lg:rounded-xl lg:text-[15px] lg:hover:bg-muted
                  ${current ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
              >
                {/* 현재 탭은 선을 굵게 해, 색 없이도(모노크롬) 구분되게 한다. */}
                <Icon size={24} strokeWidth={current ? 2.4 : 1.8} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ComponentType, type MouseEvent } from 'react';
import { TABS, activeTabOf, hidesAppChrome, type TabKey } from '@/lib/nav';
import { DiceIcon, HomeIcon, UserIcon, UsersIcon } from './icons';
import Logo from './Logo';

const ICONS: Record<TabKey, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  feed: HomeIcon,
  boardgames: DiceIcon,
  members: UsersIcon,
  my: UserIcon,
};

/**
 * 주요 메뉴. 모바일에서는 화면 아래 고정 탭바, 넓은 화면(lg 이상)에서는 왼쪽 세로 레일이다.
 * 같은 링크를 두 벌 그리지 않고 하나의 <nav>를 CSS로만 배치를 바꿔, 스크린 리더에도 메뉴가 한 번만 읽힌다.
 * 아이폰 홈 인디케이터에 가리지 않도록 safe-area 만큼 아래 여백을 더한다(layout의 viewport-fit=cover 필요).
 *
 * 탭 페이지는 모두 동적 렌더링이라, 경로(usePathname)는 서버가 다음 화면을 다 그린 뒤에야 바뀐다.
 * 경로만 보고 현재 탭을 칠하면 누른 뒤 한참 동안 이전 탭이 강조돼 반응이 없는 것처럼 보이므로,
 * 누른 탭을 바로 기억해 먼저 강조한다(낙관적 표시). 기록에는 누를 때의 경로를 함께 남겨,
 * 경로가 바뀌는 순간(이동 완료·뒤로 가기 등) 저절로 무효가 되게 했다 — effect로 지울 필요가 없다.
 */
export default function TabBar() {
  const pathname = usePathname();
  const [pressed, setPressed] = useState<{ key: TabKey; from: string } | null>(null);
  if (hidesAppChrome(pathname)) return null;
  const pending = pressed?.from === pathname ? pressed.key : null;
  const active = pending ?? activeTabOf(pathname)?.key;

  // 새 탭/새 창으로 여는 클릭(Ctrl·⌘·Shift·Alt, 가운데 버튼)은 이 화면을 떠나지 않으므로 표시를 바꾸지 않는다.
  const press = (key: TabKey) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    setPressed({ key, from: pathname });
  };

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
          const current = active === tab.key;
          return (
            <li key={tab.key} className="flex-1 lg:flex-none">
              <Link
                href={tab.href}
                onClick={press(tab.key)}
                aria-current={current ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 h-14 text-[12px] transition-colors
                  lg:flex-row lg:justify-start lg:gap-3 lg:h-12 lg:px-3 lg:rounded-xl lg:text-[16px] lg:hover:bg-muted
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

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createActionFor } from '@/lib/nav';
import { PlusIcon } from './icons';

/**
 * 탭 첫 화면(피드·보드게임·회원)의 ＋ 버튼. 탭바 바로 위(데스크톱은 화면 오른쪽 아래)에 떠 있다.
 * 무엇을 만드는지·누구에게 보이는지는 createActionFor가 정한다(생성 UI를 탭마다 같은 방식으로 통일).
 * 이동한 작성 화면은 route-guard·서버 액션이 권한을 다시 확인한다.
 */
export default function Fab({ isLoggedIn, isAdmin }: { isLoggedIn: boolean; isAdmin: boolean }) {
  const pathname = usePathname();
  const action = createActionFor(pathname, { isLoggedIn, isAdmin });
  if (!action) return null;

  return (
    <Link
      href={action.href}
      aria-label={action.label}
      className="fixed z-40 right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:right-8 lg:bottom-8
        w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center
        shadow-lg shadow-black/20 active:scale-95 transition-transform"
    >
      <PlusIcon size={28} strokeWidth={2} />
    </Link>
  );
}

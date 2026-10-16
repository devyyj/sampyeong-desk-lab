'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlusIcon } from './icons';

const WRITE_PATH = '/posts/write';

/**
 * 피드 화면에만 떠 있는 글쓰기 버튼. 탭바 바로 위(데스크톱은 화면 오른쪽 아래)에 둔다.
 * 비회원에게도 보여 주고, 누르면 로그인한 뒤 글쓰기로 돌아오게 redirect를 붙인다
 * (/posts/write는 route-guard가 보호하므로 실제 권한은 거기서 다시 확인된다).
 */
export default function Fab({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  if (pathname !== '/') return null;

  const href = isLoggedIn ? WRITE_PATH : `/login?redirect=${encodeURIComponent(WRITE_PATH)}`;
  return (
    <Link
      href={href}
      aria-label="글쓰기"
      className="fixed z-40 right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:right-8 lg:bottom-8
        w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center
        shadow-lg shadow-black/20 active:scale-95 transition-transform"
    >
      <PlusIcon size={28} strokeWidth={2} />
    </Link>
  );
}

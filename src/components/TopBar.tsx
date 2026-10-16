import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeftIcon } from './icons';

/**
 * 화면 맨 위의 얇은 바(48px). 예전 페이지마다 있던 큰 제목·부제·구분선을 대신한다.
 * - backHref가 있으면 왼쪽에 뒤로 가기(상세·편집 화면).
 * - actions는 오른쪽 아이콘 버튼 자리(등록 ＋ 등).
 * 스크롤해도 위에 붙어 있고(sticky), 활동 기록의 시즌 제목은 이 바 바로 아래(top-12)에 붙는다.
 * 페이지 콘텐츠 폭과 상관없이 화면 끝까지 바탕이 이어지도록 main의 좌우 여백(-mx-4)을 상쇄한다.
 */
export default function TopBar({
  title,
  backHref,
  backLabel = '뒤로',
  actions,
}: {
  title: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-4 px-2 h-12 flex items-center gap-1 bg-background/95 backdrop-blur border-b border-border/60">
      {backHref ? (
        <Link href={backHref} aria-label={backLabel} className="w-11 h-11 -ml-1 flex items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeftIcon size={24} />
        </Link>
      ) : (
        <span className="w-2" />
      )}
      <h1 className="flex-1 min-w-0 truncate text-[17px] font-bold tracking-tight">{title}</h1>
      {actions && <div className="flex items-center">{actions}</div>}
    </header>
  );
}

/** TopBar 오른쪽 자리에 쓰는 44px 아이콘 링크. 아이콘만 있으므로 label을 반드시 받는다. */
export function TopBarAction({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Link href={href} aria-label={label} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-muted">
      {children}
    </Link>
  );
}

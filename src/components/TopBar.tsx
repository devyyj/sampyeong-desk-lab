import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeftIcon } from './icons';

/**
 * 화면 제목 줄(48px). 예전 페이지마다 있던 큰 제목·부제·구분선을 대신한다.
 * - backHref가 있으면 왼쪽에 뒤로 가기(상세·편집 화면), 없으면 탭 첫 화면이라 제목을 크게.
 * - actions는 오른쪽 아이콘 버튼 자리(등록 ＋ 등).
 * 화면 맨 위에는 로고 헤더(AppHeader)가 고정되어 있으므로, 제목 줄까지 고정하면 위쪽이 너무 두꺼워져 함께 스크롤되게 둔다.
 *
 * 여백 규칙(모든 화면 공통): 화면은 main의 좌우 16px만 쓰고 자체 max-w·mx-auto·mt를 두지 않는다.
 * 제목 줄 아래 간격은 여기의 mb-2(8px)로만 정하고, 제목 줄 바로 다음 요소는 위쪽 여백을 두지 않는다.
 * 넓은 화면에는 로고 헤더가 없어 위쪽에 lg:mt-4를 둔다.
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
    <div className="-mx-4 mb-2 lg:mt-4 px-2 h-12 flex items-center gap-1">
      {backHref ? (
        <Link href={backHref} aria-label={backLabel} className="w-11 h-11 -ml-1 flex items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeftIcon size={24} />
        </Link>
      ) : (
        <span className="w-2" />
      )}
      <h1 className={`flex-1 min-w-0 truncate tracking-tight ${backHref ? 'text-[17px] font-bold' : 'text-[22px] font-extrabold'}`}>{title}</h1>
      {actions && <div className="flex items-center">{actions}</div>}
    </div>
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

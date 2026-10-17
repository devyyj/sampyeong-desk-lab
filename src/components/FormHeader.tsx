import Link from 'next/link';

/**
 * 데이터 생성·수정 화면(게시글·보드게임·회원) 공통 상단 바: 취소 | 제목 | 등록.
 * 이 화면들은 앱 공통 바(로고 헤더·탭바)를 숨기고(nav.hidesAppChrome) 이 바를 맨 위에 고정한다.
 * 제출 버튼이 폼 안에 있어야 Enter·버튼이 같은 제출 흐름을 타므로, 이 컴포넌트는 <form> 안에 둔다.
 */
export default function FormHeader({
  title,
  cancelHref,
  submitLabel,
  busy = false,
  busyLabel,
}: {
  title: string;
  cancelHref: string;
  submitLabel: string;
  busy?: boolean;
  busyLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 px-2 h-12 flex items-center gap-1 bg-background/95 backdrop-blur border-b border-border/60">
      <Link href={cancelHref} className="h-11 px-3 flex items-center text-[17px]">
        취소
      </Link>
      <h1 className="flex-1 text-center text-[18px] font-bold tracking-tight truncate">{title}</h1>
      <button type="submit" disabled={busy} className="h-11 px-3 text-[17px] font-bold disabled:opacity-40">
        {busy && busyLabel ? busyLabel : submitLabel}
      </button>
    </header>
  );
}

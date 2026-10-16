/**
 * 하단 탭바(데스크톱에서는 사이드 레일) 정의와 "지금 어느 탭인가" 규칙.
 * 탭바(TabBar)·글쓰기 버튼(Fab)·테스트가 같은 규칙을 쓰도록 순수 함수로 분리했다.
 */
export type TabKey = 'feed' | 'activities' | 'boardgames' | 'members' | 'my';

export type Tab = {
  key: TabKey;
  label: string;
  href: string;
  /** 이 접두사로 시작하는 경로도 이 탭으로 본다(href 자신은 항상 포함). */
  also?: string[];
};

export const TABS: readonly Tab[] = [
  // 게시글 작성·수정은 피드에서 들어가는 화면이라 피드 탭에 둔다.
  { key: 'feed', label: '피드', href: '/', also: ['/posts'] },
  { key: 'activities', label: '활동', href: '/activities' },
  { key: 'boardgames', label: '보드게임', href: '/boardgames' },
  { key: 'members', label: '회원', href: '/members' },
  // GNB가 없어지면서 프로필 편집·동호회 안내·관리자·PIN 변경은 모두 MY에서 들어간다.
  { key: 'my', label: 'MY', href: '/my', also: ['/mypage', '/about', '/admin', '/change-pin'] },
];

/** base 자신이거나 base/로 시작하면 참. '/activitiesX' 같은 경로가 '/activities'로 오인되지 않게 한다. */
function underPath(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function activeTabOf(pathname: string): Tab | null {
  for (const tab of TABS) {
    // '/'는 모든 경로의 접두사라 정확히 일치할 때만 피드로 본다.
    const own = tab.href === '/' ? pathname === '/' : underPath(pathname, tab.href);
    if (own || tab.also?.some((base) => underPath(pathname, base))) return tab;
  }
  return null;
}

/**
 * 데이터 생성·수정 화면(게시글·보드게임·회원)은 모두 같은 전체 화면 폼(FormHeader: 취소 | 제목 | 등록)을 쓰고,
 * 입력과 키보드에 화면을 다 쓰도록 앱 공통 바(로고 헤더·탭바·＋ 버튼)를 숨긴다.
 */
export function hidesAppChrome(pathname: string): boolean {
  return (
    pathname === '/posts/write' ||
    pathname === '/boardgames/add' ||
    pathname === '/members/new' ||
    /^\/(posts|boardgames)\/[^/]+\/edit\/?$/.test(pathname)
  );
}

export type CreateAction = { label: string; href: string };

/**
 * 탭 첫 화면의 ＋ 버튼(Fab)이 무엇을 만드는지. 피드·보드게임·회원 생성은 같은 버튼·같은 폼 화면으로 통일한다.
 * - 피드·보드게임: 비회원에게도 보여 주고, 누르면 로그인한 뒤 작성 화면으로 돌아오게 redirect를 붙인다.
 * - 회원 추가: 관리자에게만 보인다(실제 권한은 /members/new 페이지와 createMember가 DB로 다시 확인).
 */
export function createActionFor(pathname: string, viewer: { isLoggedIn: boolean; isAdmin: boolean }): CreateAction | null {
  const withLogin = (label: string, href: string) => ({
    label,
    href: viewer.isLoggedIn ? href : `/login?redirect=${encodeURIComponent(href)}`,
  });
  if (pathname === '/') return withLogin('글쓰기', '/posts/write');
  if (pathname === '/boardgames') return withLogin('보드게임 등록', '/boardgames/add');
  if (pathname === '/members') return viewer.isAdmin ? { label: '회원 추가', href: '/members/new' } : null;
  return null;
}

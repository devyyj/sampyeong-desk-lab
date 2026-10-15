import type { SessionPayload } from './session';

// 로그인해야 들어갈 수 있는 경로(접두사 일치)
const PROTECTED_PREFIXES = ['/mypage', '/posts/write', '/boardgames/add', '/admin', '/change-pin'];
// 게시글·보드게임 수정 페이지는 /posts/<id>/edit 형태라 접두사로는 잡히지 않는다(기존 '/posts/edit' 검사가 놓치던 경로).
const PROTECTED_PATTERNS = [/^\/(posts|boardgames)\/[^/]+\/edit(\/|$)/];

const CHANGE_PIN_PATH = '/change-pin';

const isProtected = (pathname: string) =>
  PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
  PROTECTED_PATTERNS.some((re) => re.test(pathname));

/**
 * middleware의 페이지 접근 판단. 리다이렉트할 경로를 돌려주고, 통과면 null.
 * Edge 런타임에서는 DB를 조회할 수 없으므로 세션(JWT)에 담긴 값만으로 판단한다.
 * 관리자 권한은 여기서 판단하지 않는다(로그인 여부만 확인). 실제 권한은 관리자 페이지·액션이 DB로 확인한다.
 */
export function guardRoute(pathname: string, session: Pick<SessionPayload, 'mustChangePin'> | null): string | null {
  if (!session) {
    return isProtected(pathname) ? `/login?redirect=${encodeURIComponent(pathname)}` : null;
  }
  // 관리자가 발급/초기화한 PIN을 그대로 쓰는 동안에는 PIN 변경 화면만 허용한다.
  // (모두 같은 초기 PIN을 받으므로, 바꾸기 전까지는 다른 사람이 그 계정으로 들어온 것일 수도 있다)
  if (session.mustChangePin) {
    return pathname === CHANGE_PIN_PATH ? null : CHANGE_PIN_PATH;
  }
  return pathname === CHANGE_PIN_PATH ? '/' : null;
}

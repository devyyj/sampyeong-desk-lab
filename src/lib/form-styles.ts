/**
 * 입력 폼 공통 모양. 게시글·보드게임·회원 생성/수정, 로그인·PIN 변경·프로필 편집이 같은 모양을 쓴다.
 * 입력 글자는 16px 이상: iOS Safari는 16px 미만 입력란에 초점이 가면 화면을 확대해 레이아웃이 틀어진다.
 */
export const fieldLabel = 'block text-[13px] font-semibold text-muted-foreground mb-1.5';
export const fieldInput =
  'w-full h-12 px-4 rounded-xl bg-muted text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:text-muted-foreground disabled:cursor-not-allowed';
export const fieldHint = 'mt-1.5 text-xs text-muted-foreground';
export const fieldError = 'text-sm text-red-600 font-medium';
export const fieldSuccess = 'text-sm text-green-600 font-medium';
/** 폼 화면 하단의 큰 버튼(로그인·PIN 변경 등 상단 바가 없는 화면용). */
export const submitButton =
  'w-full h-12 rounded-full bg-foreground text-background text-[16px] font-semibold active:opacity-80 disabled:opacity-40';
/** 체크박스 줄 */
export const checkboxRow = 'flex items-center gap-3 h-12 px-4 rounded-xl bg-muted text-[15px] font-medium cursor-pointer';

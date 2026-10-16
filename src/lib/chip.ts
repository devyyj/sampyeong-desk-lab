/**
 * 필터 칩 모양(알약). 서버 컴포넌트(필터 링크)와 클라이언트 컴포넌트(카테고리 시트)가 함께 쓴다.
 * 함수는 서버→클라이언트 props로 넘길 수 없어서 공용 모듈로 두고 양쪽에서 import한다.
 */
export function chipClass(active: boolean): string {
  return `h-8 px-3 inline-flex items-center rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
    active ? 'bg-foreground text-background' : 'bg-muted text-foreground'
  }`;
}

import { isActivityType, type ActivityTypeCode } from './activity-types';

/*
 * 피드 필터(?kind=&type=) ↔ 주소. 서버(페이지·액션)와 클라이언트(필터 칩)가 함께 쓰므로
 * DB·Storage 코드가 있는 feed.ts와 분리한다(클라이언트 번들에 서버 전용 모듈이 끌려 들어가지 않게).
 */

export type FeedKind = 'all' | 'activity' | 'general';
export type FeedFilter = { kind: FeedKind; type: ActivityTypeCode | null };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** 주소의 ?kind=&type= 을 필터로. 모르는 값은 조용히 기본값으로 둔다(오래된 링크·오타로 오류 화면을 띄우지 않게). */
export function parseFeedFilter(params: { kind?: string | string[]; type?: string | string[] }): FeedFilter {
  const kind = first(params.kind);
  if (kind === 'general') return { kind: 'general', type: null };
  if (kind !== 'activity') return { kind: 'all', type: null };
  const type = first(params.type);
  return { kind: 'activity', type: isActivityType(type) ? type : null };
}

export function feedFilterHref(filter: FeedFilter): string {
  if (filter.kind === 'all') return '/';
  const query = new URLSearchParams({ kind: filter.kind });
  if (filter.kind === 'activity' && filter.type) query.set('type', filter.type);
  return `/?${query}`;
}

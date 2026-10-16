import { normalizeTag } from './tags';

/*
 * 피드 주소(?tag=) ↔ 필터. 피드에는 필터 칩이 없고, 카드의 태그를 누르면 그 태그 글만 모아 본다
 * (설계: 2026-10-17-unified-post-form-design.md §4.3). 서버(페이지·액션)와 클라이언트(태그 링크)가 함께 쓰므로
 * DB·Storage 코드가 있는 feed.ts와 분리한다(클라이언트 번들에 서버 전용 모듈이 끌려 들어가지 않게).
 */

export type FeedFilter = { tag: string | null };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** 주소의 ?tag= 을 필터로. 예전 주소의 ?kind=·?type=은 무시한다(전체를 보여준다). 잘못된 태그도 무시한다. */
export function parseFeedFilter(params: { tag?: string | string[] }): FeedFilter {
  return { tag: normalizeTag(first(params.tag)) };
}

/** 태그 모아 보기 주소. 태그가 없으면 전체 피드. */
export function feedFilterHref(filter: FeedFilter): string {
  return filter.tag ? `/?${new URLSearchParams({ tag: filter.tag })}` : '/';
}

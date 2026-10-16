/*
 * 게시글 태그(posts.tags). 예전의 "활동 종류"를 대신한다(설계: 2026-10-17-unified-post-form-design.md §3.2).
 * 작성 화면의 태그 칸(클라이언트)과 서버 액션(최종 검사)이 같은 규칙을 쓰도록 한곳에 둔다.
 */

export const MAX_TAGS = 5;
/** 칩 한 개에 들어가는 길이. */
export const MAX_TAG_LENGTH = 20;
/** 작성 화면 예시. 누르면 태그로 추가된다. */
export const TAG_EXAMPLES = ['방탈출', '정기 모임', '점심', '저녁'] as const;

/**
 * 태그 하나를 저장할 모양으로 정리한다: 앞의 #는 떼고(화면에서만 붙인다), 앞뒤·중복 공백을 정리한다.
 * 비었거나 너무 길면 null.
 */
export function normalizeTag(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/^[\s#]+/, '').trim().replace(/\s+/g, ' ');
  if (!text || [...text].length > MAX_TAG_LENGTH) return null;
  return text;
}

const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** 태그 칸에서 하나를 더한다. 빈 값·중복(대소문자 무시)·개수 초과면 원래 목록을 그대로 돌려준다. */
export function addTag(tags: string[], input: string): string[] {
  const tag = normalizeTag(input);
  if (!tag || tags.length >= MAX_TAGS || tags.some((t) => sameTag(t, tag))) return tags;
  return [...tags, tag];
}

/** 폼의 tags 값들을 검사한다. Server Action은 누구나 직접 호출할 수 있어 화면의 제한을 믿지 않는다. */
export function parseTags(formData: FormData): string[] | { error: string } {
  const tags: string[] = [];
  for (const raw of formData.getAll('tags')) {
    const tag = normalizeTag(raw);
    if (!tag) return { error: `태그는 ${MAX_TAG_LENGTH}자 이하로 입력해주세요.` };
    if (!tags.some((t) => sameTag(t, tag))) tags.push(tag);
  }
  if (tags.length > MAX_TAGS) return { error: `태그는 최대 ${MAX_TAGS}개까지 달 수 있습니다.` };
  return tags;
}

import { parseTags } from './tags';

/*
 * 게시글의 선택 정보(태그·모임 날짜·시즌) 검사. 설계: 2026-10-17-unified-post-form-design.md §4.1
 * 모두 선택 입력이라 비어 있으면 없는 것으로 저장한다. Server Action은 누구나 직접 호출할 수 있어
 * 브라우저 입력 제한을 믿지 않고 여기서 다시 본다. 시즌이 실제로 있는지는 DB가 필요하므로 호출하는 액션이 확인한다.
 */

export type PostMeta = { tags: string[]; activityDate: string | null; seasonId: number | null };

/** 달력에 있는 날짜인지(2026-02-30 같은 값을 Date가 다음 달로 넘겨 받아들이는 것을 막는다). */
function isRealDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
}

export function parsePostMeta(formData: FormData): PostMeta | { error: string } {
  const tags = parseTags(formData);
  if ('error' in tags) return tags;

  const dateRaw = String(formData.get('activityDate') ?? '').trim();
  if (dateRaw && !isRealDate(dateRaw)) return { error: '모임 날짜를 확인해주세요.' };

  const seasonRaw = String(formData.get('seasonId') ?? '').trim();
  const seasonId = /^\d+$/.test(seasonRaw) ? Number(seasonRaw) : NaN;
  if (seasonRaw && (!Number.isSafeInteger(seasonId) || seasonId <= 0)) return { error: '시즌을 다시 골라주세요.' };

  return { tags, activityDate: dateRaw || null, seasonId: seasonRaw ? seasonId : null };
}

import { isActivityType, type ActivityTypeCode } from './activity-types';

/*
 * 활동 기록 입력(제목·종류·모임 날짜·시즌) 검사. 설계 §5.3.
 * Server Action은 누구나 직접 호출할 수 있어 브라우저 입력 제한(required, select)을 믿지 않고 여기서 다시 본다.
 * 시즌이 실제로 있는지는 DB가 필요하므로 호출하는 액션이 확인한다.
 */

/** 카드에서 두 줄 안에 읽히는 길이. 기존 91건 중 가장 긴 제목도 이보다 짧다. */
export const MAX_TITLE_LENGTH = 100;

export type ActivityFields = { title: string; activityType: ActivityTypeCode; activityDate: string; seasonId: number };

/** 달력에 있는 날짜인지(2026-02-30 같은 값을 Date가 다음 달로 넘겨 받아들이는 것을 막는다). */
function isRealDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
}

export function parseActivityFields(formData: FormData): ActivityFields | { error: string } {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { error: '제목을 입력해주세요.' };
  if (title.length > MAX_TITLE_LENGTH) return { error: `제목은 ${MAX_TITLE_LENGTH}자 이하로 입력해주세요.` };

  const activityType = formData.get('activityType');
  if (!isActivityType(activityType)) return { error: '활동 종류를 골라주세요.' };

  const activityDate = String(formData.get('activityDate') ?? '');
  if (!isRealDate(activityDate)) return { error: '모임 날짜를 확인해주세요.' };

  const seasonRaw = String(formData.get('seasonId') ?? '');
  const seasonId = /^\d+$/.test(seasonRaw) ? Number(seasonRaw) : NaN;
  if (!Number.isSafeInteger(seasonId) || seasonId <= 0) return { error: '시즌을 골라주세요.' };

  return { title, activityType, activityDate, seasonId };
}

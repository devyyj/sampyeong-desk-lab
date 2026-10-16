/** 활동 종류(DB의 activities.type 코드)별 화면 이름과 배지 색. */
const ACTIVITY_TYPES: Record<string, { label: string; badgeClass: string }> = {
  LUNCH: { label: '점심', badgeClass: 'bg-amber-100 text-amber-800' },
  EVENING: { label: '저녁', badgeClass: 'bg-indigo-100 text-indigo-800' },
  REGULAR: { label: '정기 모임', badgeClass: 'bg-primary-100 text-primary-600' },
  ESCAPE_ROOM: { label: '방탈출', badgeClass: 'bg-rose-100 text-rose-800' },
  OTHER: { label: '기타', badgeClass: 'bg-muted text-muted-foreground' },
};

/** 이관 이후 새 종류가 추가되어도 화면이 깨지지 않도록 모르는 코드는 '기타'로 표시한다. */
export function getActivityType(type: string) {
  return ACTIVITY_TYPES[type] ?? ACTIVITY_TYPES.OTHER;
}

/** 필터 칩·작성 화면의 종류 순서. 큰 행사(방탈출·정기 모임)를 앞에 둔다. */
export const ACTIVITY_TYPE_CODES = ['ESCAPE_ROOM', 'REGULAR', 'LUNCH', 'EVENING', 'OTHER'] as const;
export type ActivityTypeCode = (typeof ACTIVITY_TYPE_CODES)[number];

/** 주소(?type=)·폼으로 들어온 값이 정해진 코드인지. 화면 표시용 getActivityType과 달리 모르는 값을 '기타'로 바꾸지 않고 거른다. */
export function isActivityType(value: unknown): value is ActivityTypeCode {
  return typeof value === 'string' && (ACTIVITY_TYPE_CODES as readonly string[]).includes(value);
}

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

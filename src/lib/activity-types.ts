/*
 * 활동 기록의 종류(posts.activity_type). 정해진 목록에서 고르지 않고 회원이 글자로 입력한다
 * (방탈출·정기 모임 같은 정해진 모임 말고도 "보드게임 카페", "번개" 같은 활동이 생겨서).
 * DB에는 입력한 이름을 그대로 저장한다. 예전에는 코드(ESCAPE_ROOM 등)로 저장했고 0007 마이그레이션으로 이름으로 바꿨다.
 */

/** 배지에 들어가는 길이. DB 칼럼도 varchar(20)이다. */
export const MAX_ACTIVITY_TYPE_LENGTH = 20;

/** 작성 화면에 보여주는 예시. 누르면 입력란에 채워진다. */
export const ACTIVITY_TYPE_EXAMPLES = ['방탈출', '정기 모임', '점심', '저녁'] as const;

/** 예전 코드 → 이름. 0007 적용 전 데이터와 예전 주소(?type=ESCAPE_ROOM)를 읽을 때만 쓴다. */
const LEGACY_CODES: Record<string, string> = {
  LUNCH: '점심',
  EVENING: '저녁',
  REGULAR: '정기 모임',
  ESCAPE_ROOM: '방탈출',
  OTHER: '기타',
};

/** 자주 쓰는 종류의 배지 색. 그 밖의 종류는 기본(회색) 배지다. */
const BADGE_CLASSES: Record<string, string> = {
  점심: 'bg-amber-100 text-amber-800',
  저녁: 'bg-indigo-100 text-indigo-800',
  '정기 모임': 'bg-primary-100 text-primary-600',
  방탈출: 'bg-rose-100 text-rose-800',
};
const DEFAULT_BADGE = 'bg-muted text-muted-foreground';

/** 배지 표시용 이름과 색. 예전 코드는 이름으로 바꿔 보여준다. */
export function getActivityType(value: string) {
  const label = LEGACY_CODES[value] ?? value;
  return { label, badgeClass: BADGE_CLASSES[label] ?? DEFAULT_BADGE };
}

/**
 * 폼·주소로 들어온 종류를 저장·비교할 값으로 정리한다. 앞뒤·중복 공백을 정리하고, 예전 코드는 이름으로 바꾼다.
 * 비었거나 너무 길면 null(호출하는 쪽이 오류로 알리거나 필터를 무시한다).
 */
export function normalizeActivityType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text || [...text].length > MAX_ACTIVITY_TYPE_LENGTH) return null;
  return LEGACY_CODES[text] ?? text;
}

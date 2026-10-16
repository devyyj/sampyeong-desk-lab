/**
 * 화면용 날짜·시간 표기.
 * 서버(Vercel)는 UTC로 돌기 때문에 시간대를 지정하지 않으면 한국 새벽 시간대 글이 전날로 찍힌다.
 * 그래서 날짜를 만들 때는 항상 Asia/Seoul 기준으로 연·월·일·요일을 뽑는다.
 */
const TZ = 'Asia/Seoul';
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 한국 시간 기준 연·월·일·요일(0=일) */
function seoulParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })
    .formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
  };
}

/** "10월 1일" / 해가 다르면 "2025년 12월 31일" */
function dateLabel(date: Date, now: Date): string {
  const d = seoulParts(date);
  const sameYear = d.year === seoulParts(now).year;
  return sameYear ? `${d.month}월 ${d.day}일` : `${d.year}년 ${d.month}월 ${d.day}일`;
}

/**
 * 피드용 상대 시간: 방금 / N분 전 / N시간 전 / N일 전, 일주일이 넘으면 날짜.
 * 미래 시각(서버·DB 시계 오차)은 음수가 되지 않게 '방금'으로 본다.
 */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MIN) return '방금';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`;
  return dateLabel(date, now);
}

/**
 * 활동 기록용 짧은 날짜 "9월 18일 (금)". DB의 date 컬럼 문자열(YYYY-MM-DD)을 받는다.
 * 시각이 없는 날짜라 정오(KST)로 두고 계산해 시간대 경계에서 하루 밀리지 않게 한다.
 */
export function shortDate(ymd: string, now: Date = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const date = new Date(`${ymd}T12:00:00+09:00`);
  return `${dateLabel(date, now)} (${WEEKDAYS[seoulParts(date).weekday]})`;
}

/**
 * 한국 날짜 "YYYY-MM-DD"(활동 기록 작성 화면의 모임 날짜 기본값). 서버가 계산해 폼에 넘긴다:
 * 브라우저에서 계산하면 서버 렌더와 값이 달라질 수 있고(hydration 불일치), UTC 서버에서는 한국 오전 9시 전에 전날이 된다.
 */
export function todayKst(now: Date = new Date()): string {
  const { year, month, day } = seoulParts(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

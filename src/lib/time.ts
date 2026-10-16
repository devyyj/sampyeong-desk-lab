/**
 * 화면용 날짜·시간 표기.
 * 서버(Vercel)는 UTC로 돌기 때문에 시간대를 지정하지 않으면 한국 새벽 시간대 글이 전날로 찍힌다.
 * 그래서 날짜를 만들 때는 항상 Asia/Seoul 기준으로 연·월·일을 뽑는다.
 */
const TZ = 'Asia/Seoul';
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** 한국 시간 기준 연·월·일 */
function seoulParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')) };
}

/** "10월 1일" / 해가 다르면 "2025년 12월 31일" */
function dateLabel(date: Date, now: Date): string {
  const d = seoulParts(date);
  const sameYear = d.year === seoulParts(now).year;
  return sameYear ? `${d.month}월 ${d.day}일` : `${d.year}년 ${d.month}월 ${d.day}일`;
}

/**
 * 작성일 표기(앱 전체에서 이 한 가지 방식만 쓴다): 방금 / N분 전 / N시간 전 / N일 전, 일주일이 넘으면 날짜.
 * 게시글 카드·상세·댓글이 모두 이 표기를 쓰고, 시각 없는 날짜(활동 기록의 모임 날짜)는 같은 규칙의 relativeDay를 쓴다.
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
 * 시각 없는 날짜(YYYY-MM-DD, 활동 기록의 모임 날짜)의 표기. relativeTime과 같은 규칙으로 맞춘다:
 * 오늘 / N일 전, 일주일이 넘거나 앞으로의 날짜면 날짜. 시각이 없어 분·시간 단위는 쓰지 않는다.
 * 날짜 차이는 한국 날짜끼리 센다(UTC 서버에서 한국 새벽에 하루 밀리지 않게).
 */
export function relativeDay(ymd: string, now: Date = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const days = Math.round((Date.parse(todayKst(now)) - Date.parse(ymd)) / DAY);
  if (days === 0) return '오늘';
  if (days > 0 && days < 7) return `${days}일 전`;
  // 정오(KST)로 두고 날짜를 뽑아 시간대 경계에서 하루 밀리지 않게 한다.
  return dateLabel(new Date(`${ymd}T12:00:00+09:00`), now);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 본문에 적는 모임 날짜(YYYY-MM-DD) 표기: "2026년 7월 31일 (금)".
 * 머리줄 날짜는 "3일 전"처럼 상대 표기라 정확히 언제 모였는지 알기 어려워, 모임 날짜는 연도·요일까지 그대로 적는다.
 * 시각이 없는 날짜라 시간대 변환 없이 숫자로 계산한다(UTC 정오로 요일만 뽑는다).
 */
export function meetingDayLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

/**
 * 한국 날짜 "YYYY-MM-DD"(활동 기록 작성 화면의 모임 날짜 기본값). 서버가 계산해 폼에 넘긴다:
 * 브라우저에서 계산하면 서버 렌더와 값이 달라질 수 있고(hydration 불일치), UTC 서버에서는 한국 오전 9시 전에 전날이 된다.
 */
export function todayKst(now: Date = new Date()): string {
  const { year, month, day } = seoulParts(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

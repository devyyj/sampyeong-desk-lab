// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { relativeTime, relativeDay, todayKst } from './time';

// 기준 시각: 2026-10-16 21:00 KST (= 12:00 UTC)
const now = new Date('2026-10-16T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
  it.each([
    [ago(20_000), '방금'],
    [ago(5 * MIN), '5분 전'],
    [ago(59 * MIN), '59분 전'],
    [ago(2 * HOUR), '2시간 전'],
    [ago(23 * HOUR), '23시간 전'],
    [ago(1 * DAY), '1일 전'],
    [ago(6 * DAY), '6일 전'],
    // 일주일이 넘으면 날짜로(같은 해는 연도 생략)
    [new Date('2026-10-01T10:00:00Z'), '10월 1일'],
    [new Date('2025-12-31T10:00:00Z'), '2025년 12월 31일'],
    // 미래 시각(서버 시계 오차)은 '방금'으로
    [new Date(now.getTime() + 30_000), '방금'],
  ])('%s → %s', (date, expected) => {
    expect(relativeTime(date, now)).toBe(expected);
  });

  it('날짜는 서버 시간대(UTC)가 아니라 한국 시간 기준', () => {
    // 2026-09-30 16:00 UTC = 2026-10-01 01:00 KST
    expect(relativeTime(new Date('2026-09-30T16:00:00Z'), now)).toBe('10월 1일');
  });
});

describe('relativeDay (시각 없는 날짜 — 활동 기록의 모임 날짜)', () => {
  // relativeTime과 같은 표기 규칙: 일 단위 상대 표기, 일주일이 넘으면 날짜(같은 해는 연도 생략).
  it.each([
    ['2026-10-16', '오늘'],
    ['2026-10-15', '1일 전'],
    ['2026-10-10', '6일 전'],
    ['2026-10-09', '10월 9일'],
    ['2025-12-31', '2025년 12월 31일'],
    // 앞으로 있을 모임은 날짜로 보여준다.
    ['2026-10-20', '10월 20일'],
  ])('%s → %s', (ymd, expected) => {
    expect(relativeDay(ymd, now)).toBe(expected);
  });

  it('한국 날짜 기준으로 센다(UTC로는 아직 전날이어도)', () => {
    // 2026-10-16 15:30 UTC = 2026-10-17 00:30 KST
    expect(relativeDay('2026-10-17', new Date('2026-10-16T15:30:00Z'))).toBe('오늘');
  });

  it('형식이 다른 값은 그대로 돌려준다', () => {
    expect(relativeDay('미정', now)).toBe('미정');
  });
});

describe('todayKst', () => {
  it('한국 날짜(YYYY-MM-DD). UTC로는 전날이어도 한국이 다음 날이면 다음 날', () => {
    expect(todayKst(new Date('2026-10-16T15:30:00Z'))).toBe('2026-10-17');
    expect(todayKst(new Date('2026-10-16T14:59:00Z'))).toBe('2026-10-16');
  });
});

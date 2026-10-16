// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ACTIVITY_TYPE_CODES, getActivityType, isActivityType } from './activity-types';

describe('getActivityType', () => {
  it.each([
    ['LUNCH', '점심'],
    ['EVENING', '저녁'],
    ['REGULAR', '정기 모임'],
    ['ESCAPE_ROOM', '방탈출'],
    ['OTHER', '기타'],
  ])('%s → %s', (type, label) => {
    expect(getActivityType(type).label).toBe(label);
  });

  it('모르는 종류는 기타로 표시', () => {
    expect(getActivityType('UNKNOWN').label).toBe('기타');
  });
});

describe('ACTIVITY_TYPE_CODES / isActivityType', () => {
  it('필터 칩·작성 화면에 쓰는 순서(방탈출 → 정기 모임 → 점심 → 저녁 → 기타)', () => {
    expect(ACTIVITY_TYPE_CODES).toEqual(['ESCAPE_ROOM', 'REGULAR', 'LUNCH', 'EVENING', 'OTHER']);
  });
  it('정해진 코드만 참(사용자 입력 검증용)', () => {
    expect(isActivityType('LUNCH')).toBe(true);
    expect(isActivityType('UNKNOWN')).toBe(false);
    expect(isActivityType(null)).toBe(false);
  });
});

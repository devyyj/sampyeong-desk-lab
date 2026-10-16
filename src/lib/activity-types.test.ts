// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { getActivityType } from './activity-types';

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

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ACTIVITY_TYPE_EXAMPLES, MAX_ACTIVITY_TYPE_LENGTH, getActivityType, normalizeActivityType } from './activity-types';

describe('getActivityType (배지 표시)', () => {
  it('입력한 글자를 그대로 배지 이름으로 쓰고, 자주 쓰는 종류에는 색을 준다', () => {
    expect(getActivityType('방탈출')).toEqual({ label: '방탈출', badgeClass: expect.stringContaining('rose') });
    expect(getActivityType('보드게임 카페')).toEqual({ label: '보드게임 카페', badgeClass: 'bg-muted text-muted-foreground' });
  });

  it.each([
    ['LUNCH', '점심'],
    ['EVENING', '저녁'],
    ['REGULAR', '정기 모임'],
    ['ESCAPE_ROOM', '방탈출'],
    ['OTHER', '기타'],
  ])('예전 코드(%s)는 이름(%s)으로 보여준다(마이그레이션 전 데이터 호환)', (code, label) => {
    expect(getActivityType(code).label).toBe(label);
    expect(getActivityType(code)).toEqual(getActivityType(label));
  });
});

describe('normalizeActivityType (입력 정리)', () => {
  it('앞뒤·중복 공백을 정리한다', () => {
    expect(normalizeActivityType('  정기   모임 ')).toBe('정기 모임');
  });
  it('예전 코드는 이름으로 바꾼다(주소의 ?type=ESCAPE_ROOM 같은 옛 링크)', () => {
    expect(normalizeActivityType('ESCAPE_ROOM')).toBe('방탈출');
  });
  it('비었거나 너무 길면 null', () => {
    expect(normalizeActivityType('   ')).toBeNull();
    expect(normalizeActivityType('가'.repeat(MAX_ACTIVITY_TYPE_LENGTH + 1))).toBeNull();
    expect(normalizeActivityType(null)).toBeNull();
  });
});

it('작성 화면 예시(누르면 입력란에 채워진다)', () => {
  expect(ACTIVITY_TYPE_EXAMPLES).toEqual(['방탈출', '정기 모임', '점심', '저녁']);
});

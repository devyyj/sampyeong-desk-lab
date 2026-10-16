// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseActivityFields, MAX_TITLE_LENGTH } from './activity-fields';

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};
const ok = { title: ' 제 9회 정기모임 ', activityType: 'REGULAR', activityDate: '2026-10-16', seasonId: '5' };

describe('parseActivityFields (활동 기록 입력 검사)', () => {
  it('제목은 앞뒤 공백을 지우고, 시즌은 숫자로 바꾼다', () => {
    expect(parseActivityFields(form(ok))).toEqual({
      title: '제 9회 정기모임', activityType: 'REGULAR', activityDate: '2026-10-16', seasonId: 5,
    });
  });

  it('제목이 비었거나 너무 길면 거부', () => {
    expect(parseActivityFields(form({ ...ok, title: '  ' }))).toEqual({ error: '제목을 입력해주세요.' });
    expect(parseActivityFields(form({ ...ok, title: '가'.repeat(MAX_TITLE_LENGTH + 1) }))).toEqual({
      error: `제목은 ${MAX_TITLE_LENGTH}자 이하로 입력해주세요.`,
    });
  });

  it('정해진 종류만 받는다', () => {
    expect(parseActivityFields(form({ ...ok, activityType: 'PARTY' }))).toEqual({ error: '활동 종류를 골라주세요.' });
  });

  it('날짜는 실제로 있는 YYYY-MM-DD만', () => {
    for (const bad of ['', '2026-13-01', '2026-02-30', '26-10-16', '2026-10-16T00:00']) {
      expect(parseActivityFields(form({ ...ok, activityDate: bad })), bad).toEqual({ error: '모임 날짜를 확인해주세요.' });
    }
  });

  it('시즌은 양의 정수(실제로 있는 시즌인지는 액션이 DB로 확인)', () => {
    for (const bad of ['', '0', '-1', '1.5', 'x']) {
      expect(parseActivityFields(form({ ...ok, seasonId: bad })), bad).toEqual({ error: '시즌을 골라주세요.' });
    }
  });
});

import { describe, it, expect } from 'vitest';
import { validateNickname, NICKNAME_LENGTH_ERROR } from './nickname';
import { isUniqueViolation, isForeignKeyViolation } from './pg-errors';

describe('validateNickname', () => {
  it('앞뒤 공백을 제거한 값을 돌려준다', () => {
    expect(validateNickname('  보드왕 ')).toEqual({ ok: true, nickname: '보드왕' });
  });

  it('2자 미만·20자 초과는 거부하고, 2자·20자는 허용한다', () => {
    expect(validateNickname('가')).toEqual({ ok: false, error: NICKNAME_LENGTH_ERROR });
    expect(validateNickname('   ')).toEqual({ ok: false, error: NICKNAME_LENGTH_ERROR });
    expect(validateNickname('가'.repeat(21))).toEqual({ ok: false, error: NICKNAME_LENGTH_ERROR });
    expect(validateNickname('가나')).toEqual({ ok: true, nickname: '가나' });
    expect(validateNickname('가'.repeat(20))).toEqual({ ok: true, nickname: '가'.repeat(20) });
  });

  it('길이는 UTF-16 코드 단위가 아닌 글자 수로 센다(DB varchar(20)과 같은 기준)', () => {
    // 이모지는 JS length로 2지만 Postgres varchar는 1글자로 센다.
    expect(validateNickname('🎲'.repeat(20))).toEqual({ ok: true, nickname: '🎲'.repeat(20) });
    expect(validateNickname('🎲')).toEqual({ ok: false, error: NICKNAME_LENGTH_ERROR });
  });
});

describe('isUniqueViolation', () => {
  it('Postgres 23505 오류를 알아본다(Drizzle이 cause로 감싸는 경우 포함)', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation(Object.assign(new Error('Failed query'), { cause: { code: '23505' } }))).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isForeignKeyViolation({ cause: { code: '23503' } })).toBe(true);
    expect(isForeignKeyViolation({ code: '23505' })).toBe(false);
  });
});

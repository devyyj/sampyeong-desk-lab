// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolveSeason } from './seasons';

const seasons = [
  { id: 1, name: '시즌 1', period: '25년 4분기' },
  { id: 3, name: '시즌 3', period: '26년 2분기' },
  { id: 2, name: '시즌 2', period: '26년 1분기' },
];

describe('resolveSeason', () => {
  it('값이 없으면 가장 최근(id가 가장 큰) 시즌', () => {
    expect(resolveSeason(undefined, seasons)?.id).toBe(3);
  });

  it('존재하는 시즌 id면 그 시즌', () => {
    expect(resolveSeason('2', seasons)?.id).toBe(2);
  });

  it.each(['99', 'abc', '', '1.5'])('잘못된 값(%s)이면 최근 시즌', (param) => {
    expect(resolveSeason(param, seasons)?.id).toBe(3);
  });

  it('같은 키가 여러 번 오면(배열) 첫 값을 쓴다', () => {
    expect(resolveSeason(['1', '2'], seasons)?.id).toBe(1);
  });

  it('시즌이 하나도 없으면 null', () => {
    expect(resolveSeason('1', [])).toBeNull();
  });
});

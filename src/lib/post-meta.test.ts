// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parsePostMeta } from './post-meta';

const form = (fields: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const item of [v].flat()) fd.append(k, item);
  return fd;
};

describe('parsePostMeta (선택 정보: 태그·모임 날짜·시즌)', () => {
  it('모두 비워 두면 빈 태그, 날짜·시즌 없음', () => {
    expect(parsePostMeta(form({}))).toEqual({ tags: [], activityDate: null, seasonId: null });
    expect(parsePostMeta(form({ activityDate: '', seasonId: '' }))).toEqual({ tags: [], activityDate: null, seasonId: null });
  });

  it('입력한 값은 정리해서 돌려준다', () => {
    expect(parsePostMeta(form({ tags: ['#방탈출', '스컬킹'], activityDate: '2026-10-16', seasonId: '5' }))).toEqual({
      tags: ['방탈출', '스컬킹'],
      activityDate: '2026-10-16',
      seasonId: 5,
    });
  });

  it('날짜는 실제로 있는 YYYY-MM-DD만', () => {
    for (const bad of ['2026-13-01', '2026-02-30', '26-10-16', '2026-10-16T00:00']) {
      expect(parsePostMeta(form({ activityDate: bad })), bad).toEqual({ error: '모임 날짜를 확인해주세요.' });
    }
  });

  it('시즌은 양의 정수(실제로 있는 시즌인지는 액션이 DB로 확인)', () => {
    for (const bad of ['0', '-1', '1.5', 'x']) {
      expect(parsePostMeta(form({ seasonId: bad })), bad).toEqual({ error: '시즌을 다시 골라주세요.' });
    }
  });

  it('태그 규칙을 어기면 오류', () => {
    expect(parsePostMeta(form({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] }))).toEqual({ error: '태그는 최대 5개까지 달 수 있습니다.' });
  });
});

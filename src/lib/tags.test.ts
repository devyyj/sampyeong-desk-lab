// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { MAX_TAGS, MAX_TAG_LENGTH, TAG_EXAMPLES, addTag, normalizeTag, parseTags } from './tags';

describe('normalizeTag (태그 하나 정리)', () => {
  it('앞의 #와 앞뒤·중복 공백을 정리한다', () => {
    expect(normalizeTag('  #정기   모임 ')).toBe('정기 모임');
    expect(normalizeTag('##방탈출')).toBe('방탈출');
  });
  it('비었거나 너무 길면 null', () => {
    expect(normalizeTag(' # ')).toBeNull();
    expect(normalizeTag('가'.repeat(MAX_TAG_LENGTH + 1))).toBeNull();
    expect(normalizeTag(null)).toBeNull();
  });
});

describe('addTag (입력 칸에서 태그 추가)', () => {
  it('정리해서 끝에 붙이고, 이미 있으면(대소문자 무시) 그대로', () => {
    expect(addTag(['점심'], ' #스컬킹 ')).toEqual(['점심', '스컬킹']);
    expect(addTag(['Skull'], 'skull')).toEqual(['Skull']);
  });
  it('비었거나 이미 5개면 그대로', () => {
    expect(addTag(['a'], '  ')).toEqual(['a']);
    const five = ['a', 'b', 'c', 'd', 'e'];
    expect(addTag(five, 'f')).toBe(five);
  });
});

describe('parseTags (서버 최종 검사)', () => {
  const form = (tags: string[]) => {
    const fd = new FormData();
    for (const t of tags) fd.append('tags', t);
    return fd;
  };
  it('정리·중복 제거한 목록', () => {
    expect(parseTags(form(['#점심', ' 점심 ', '스컬킹']))).toEqual(['점심', '스컬킹']);
    expect(parseTags(form([]))).toEqual([]);
  });
  it('5개를 넘거나 잘못된 태그가 있으면 오류', () => {
    expect(parseTags(form(['a', 'b', 'c', 'd', 'e', 'f']))).toEqual({ error: `태그는 최대 ${MAX_TAGS}개까지 달 수 있습니다.` });
    expect(parseTags(form(['가'.repeat(21)]))).toEqual({ error: `태그는 ${MAX_TAG_LENGTH}자 이하로 입력해주세요.` });
  });
});

it('예시 태그', () => {
  expect(TAG_EXAMPLES).toEqual(['방탈출', '정기 모임', '점심', '저녁']);
});

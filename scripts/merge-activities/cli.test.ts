// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseArgs, verifyCounts } from './cli';

describe('parseArgs', () => {
  it('기본값은 dry-run(DB에 쓰지 않음)', () => {
    expect(parseArgs([])).toEqual({ apply: false });
  });
  it('--apply일 때만 실제로 쓴다', () => {
    expect(parseArgs(['--apply'])).toEqual({ apply: true });
  });
  it('알 수 없는 옵션은 거부(--aply 같은 오타가 조용히 dry-run이 되지 않게)', () => {
    expect(() => parseArgs(['--aply'])).toThrow('--aply');
  });
});

describe('verifyCounts (적용 후 검증)', () => {
  const expected = { posts: 91, images: 197, likes: 1, comments: 1 };

  it('계획한 건수와 DB 건수가 모두 같으면 통과', () => {
    expect(() => verifyCounts(expected, { ...expected, leftoverActivityComments: 0 })).not.toThrow();
  });

  it('하나라도 다르면 어떤 항목이 몇 건인지 알려 주며 멈춘다(트랜잭션 롤백)', () => {
    expect(() => verifyCounts(expected, { ...expected, images: 196, leftoverActivityComments: 0 })).toThrow('사진: 계획 197, 실제 196');
  });

  it('activity_id가 남은 댓글이 있으면 실패', () => {
    expect(() => verifyCounts(expected, { ...expected, leftoverActivityComments: 1 })).toThrow('activity_id');
  });
});

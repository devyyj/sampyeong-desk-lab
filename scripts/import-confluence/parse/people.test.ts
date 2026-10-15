// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseFragment } from './html';
import { parseMention, collectPeople } from './people';

// 익명화한 Confluence 사용자 멘션 마크업
const mention = (username: string, text: string) =>
  parseFragment(`<a class="confluence-userlink user-mention" data-username="${username}" href="https://docs/display/~${username}">${text}</a>`)
    .querySelector('a')!;

describe('parseMention', () => {
  it('"이름/부서"를 첫 / 기준으로 분리하고 부서 안의 공백은 유지', () => {
    expect(parseMention(mention('kim.test', '김테스트/SaaS개발 TF'))).toEqual({
      username: 'kim.test', displayName: '김테스트', department: 'SaaS개발 TF', unknown: false,
    });
  });

  it('Unknown User는 unknown=true, 이름/부서 null', () => {
    expect(parseMention(mention('gone.user', 'Unknown User (gone.user)'))).toEqual({
      username: 'gone.user', displayName: null, department: null, unknown: true,
    });
  });
});

describe('collectPeople', () => {
  it('같은 사람은 먼저 나온 값(최신 시즌) 우선, Unknown 제외', () => {
    const people = collectPeople([
      { username: 'kim.test', displayName: '김테스트', department: '시즌2부서', unknown: false },
      { username: 'gone.user', displayName: null, department: null, unknown: true },
      { username: 'kim.test', displayName: '김테스트', department: '시즌1부서', unknown: false },
    ]);
    expect(people).toEqual([{ username: 'kim.test', displayName: '김테스트', department: '시즌2부서' }]);
  });
});

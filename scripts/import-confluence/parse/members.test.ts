// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseSeasonTitle, parseRosterTitle, parseRoster } from './members';

// 익명화한 시즌 명부 표: [username, 링크 텍스트, 비고 셀 HTML]
const rosterHtml = (rows: [string, string, string][]) =>
  '<table><tbody><tr><th class="numberingColumn"></th><th>이름</th><th>비고</th></tr>' +
  rows
    .map(([u, text, note], i) =>
      `<tr><td class="numberingColumn">${i + 1}</td>` +
      `<td><div class="content-wrapper"><p><a class="confluence-userlink" data-username="${u}">${text}</a></p></div></td>` +
      `<td>${note}</td></tr>`)
    .join('') +
  '</tbody></table>';

describe('parseSeasonTitle / parseRosterTitle', () => {
  it('활동 페이지 제목에서 시즌 번호와 기간 추출 (이모지 무시)', () => {
    expect(parseSeasonTitle('시즌 5 (26년 4분기)🎄')).toEqual({ id: 5, name: '시즌 5', period: '26년 4분기' });
    expect(parseSeasonTitle('시즌 5 회원 명부')).toBeNull();
  });

  it('명부 페이지 제목에서 시즌 번호 추출', () => {
    expect(parseRosterTitle('시즌 3 회원 명부')).toBe(3);
    expect(parseRosterTitle('시즌 3 (26년 2분기)')).toBeNull();
  });
});

describe('parseRoster', () => {
  it('회장 추출(헤딩 안이어도), 나머지 원문은 note, 빈 비고는 null, Unknown 제외', () => {
    const r = parseRoster(5, rosterHtml([
      ['kim.test', '김테스트/A팀', '<h1><span>👨‍🍼회장</span></h1>'],
      ['lee.test', '이테스트/B팀', '💎'],
      ['park.test', '박테스트/C팀', '<br/>'],
      ['gone.user', 'Unknown User (gone.user)', ''],
    ]));

    expect(r.members).toEqual([
      { seasonId: 5, username: 'kim.test', role: '회장', note: '👨‍🍼' },
      { seasonId: 5, username: 'lee.test', role: null, note: '💎' },
      { seasonId: 5, username: 'park.test', role: null, note: null },
    ]);
    expect(r.skippedUnknown).toEqual(['gone.user']);
    expect(r.mentions.map((m) => m.username)).toEqual(['kim.test', 'lee.test', 'park.test', 'gone.user']);
  });
});

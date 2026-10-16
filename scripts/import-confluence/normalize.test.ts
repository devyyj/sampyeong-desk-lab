// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalize } from './normalize';
import type { ConfluencePage } from './types';

const m = (u: string, text: string) => `<a class="confluence-userlink" data-username="${u}">${text}</a>`;
const table = (rows: string[][]) =>
  '<table><tbody><tr><th>h</th></tr>' + rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
const p = (id: string, title: string, html = ''): ConfluencePage => ({ id, title, parents: [], html });

// 익명화한 최소 페이지 세트: 시즌 1·2 활동/명부, 보유 현황, 보관함, 회칙 (+ 이관 대상 아닌 상위 페이지)
function minimalPages(): ConfluencePage[] {
  return [
    p('root', '삼평동 책상 전략 연구소 🧑‍🔬', '<h1>그냥 놀고 싶습니다.</h1>'),
    p('rules', '회칙👑', '<h1>1. 목적</h1><p>놀기</p>'),
    p('acts', '활동 현황🥷'),
    p('a2', '시즌 2 (26년 1분기)', table([['<time datetime="2026-01-05">x</time>', '<ul><li>점심 연구</li></ul>', '']])),
    p('a1', '시즌 1 (25년 4분기)', table([
      ['<time datetime="2025-12-19">x</time>', '<ul><li>저녁 연구</li></ul>', ''],
      ['<time datetime="2025-12-20">x</time>', '<ul><li>점심 연구</li></ul>', ''],
    ])),
    p('cab', '공용 보드 게임 보관함🎁', `<h1>1. 위치</h1><p>6층</p><h1>3. 보관중인 게임 목록</h1>${table([['딕싯', m('kim.test', '김테스트/시즌2부서'), '']])}`),
    p('inv', '보드 게임 보유 현황🎲', table([['딕싯', '파티', '3명', m('owner.only', '보유자/게임팀'), '']])),
    p('roster', '회원 명부🧛'),
    p('r2', '시즌 2 회원 명부', table([[m('kim.test', '김테스트/시즌2부서'), '회장']])),
    p('r1', '시즌 1 회원 명부', table([[m('kim.test', '김테스트/시즌1부서'), ''], [m('gone.user', 'Unknown User (gone.user)'), '']])),
  ];
}

describe('normalize', () => {
  it('페이지를 제목으로 찾아 각 레코드 배열을 만든다', () => {
    const n = normalize(minimalPages());

    expect(n.seasons).toEqual([
      { id: 1, name: '시즌 1', period: '25년 4분기' },
      { id: 2, name: '시즌 2', period: '26년 1분기' },
    ]);
    // 활동 행은 더 이상 만들지 않는다(시즌 페이지는 시즌 목록에만 쓴다).
    expect(n).not.toHaveProperty('activities');
    expect(n.seasonMembers).toHaveLength(2);
    expect(n.boardGames).toHaveLength(2); // 보유 현황 딕싯(owner.only) + 소유자가 다른 보관함 딕싯(kim.test)
    expect(n.documents.map((d) => d.slug)).toEqual(['rules', 'shared-cabinet']);
  });

  it('people: 최신 시즌 명부의 부서 우선, 명부에 없는 보유자도 포함, Unknown 제외', () => {
    const n = normalize(minimalPages());
    expect(n.people).toEqual([
      { username: 'kim.test', displayName: '김테스트', department: '시즌2부서' },
      { username: 'owner.only', displayName: '보유자', department: '게임팀' },
    ]);
    expect(n.report.skippedUnknownUsers).toEqual(['gone.user']);
    expect(n.report.cabinetUnmatched).toEqual(['딕싯 (kim.test)']);
  });

  it('필수 페이지(보유 현황)가 없으면 throw', () => {
    expect(() => normalize(minimalPages().filter((pg) => pg.id !== 'inv'))).toThrow('보드 게임 보유 현황');
  });
});

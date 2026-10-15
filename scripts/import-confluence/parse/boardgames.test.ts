// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseBoardGames, normalizeGameName } from './boardgames';

const owner = (u: string) =>
  u === '' ? '' : `<div class="content-wrapper"><p><a class="confluence-userlink" data-username="${u}">${u.startsWith('gone') ? `Unknown User (${u})` : `${u}이름/${u}팀`}</a></p></div>`;
const table = (header: string[], rows: string[][]) =>
  `<table><tbody><tr><th class="numberingColumn"></th>${header.map((h) => `<th>${h}</th>`).join('')}</tr>` +
  rows.map((r, i) => `<tr><td class="numberingColumn">${i + 1}</td>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') +
  '</tbody></table>';
// 보유 현황: [이름, 카테고리, 플레이 인원, 보유자 username, 비고]
const inv = (rows: [string, string, string, string, string][]) =>
  table(['게임 이름', '카테고리', '플레이 인원', '보유자', '비고'], rows.map(([n, c, p, u, note]) => [n, c, p, owner(u), note]));
// 보관함 페이지: 안내 문단 + 마지막 표 [이름, 소유자 username, 비고]
const cab = (rows: [string, string, string][]) =>
  '<h1>1. 위치</h1><p>안내</p><h1>3. 보관중인 게임 목록</h1>' +
  table(['게임 이름', '소유자', '비고'], rows.map(([n, u, note]) => [n, owner(u), note]));

describe('normalizeGameName', () => {
  it('공백·기호 제거, 소문자', () => {
    expect(normalizeGameName('한밤의 늑대 인간')).toBe(normalizeGameName('한밤의 늑대인간'));
    expect(normalizeGameName('다잉 메시지(+공범의 그림자)')).toBe('다잉메시지공범의그림자');
    expect(normalizeGameName('UNLOCK! 1')).toBe('unlock1');
  });
});

describe('parseBoardGames', () => {
  it('보관함 게임을 정규화 이름+소유자로 매칭해 inSharedCabinet=true', () => {
    const r = parseBoardGames(inv([['한밤의 늑대인간', '마피아', ' ', 'kim.test', '']]), cab([['한밤의 늑대 인간', 'kim.test', '']]));
    expect(r.games).toEqual([{
      sourceKey: '한밤의늑대인간:kim.test', name: '한밤의 늑대인간', category: '마피아', recommendedPlayers: null,
      ownerUsername: 'kim.test', note: null, inSharedCabinet: true,
    }]);
    expect(r.cabinetUnmatched).toEqual([]);
    expect(r.ownerMentions.map((m) => m.username)).toEqual(['kim.test', 'kim.test']);
  });

  it('이름이 같아도 소유자가 다르면 매칭하지 않음 → 새 게임 추가 + 리포트', () => {
    const r = parseBoardGames(inv([['코드네임', '파티', '', 'kim.test', '']]), cab([['코드네임', 'lee.test', '']]));
    expect(r.games).toHaveLength(2);
    expect(r.games[1]).toMatchObject({ name: '코드네임', category: null, ownerUsername: 'lee.test', inSharedCabinet: true, sourceKey: '코드네임:lee.test' });
    expect(r.cabinetUnmatched).toEqual(['코드네임 (lee.test)']);
  });

  it('보유 현황 내 같은 이름·보유자 중복은 첫 행만 남기고 리포트', () => {
    const r = parseBoardGames(inv([['루미큐브', '숫자', '2명 ~ 4명', 'kim.test', ''], ['루미 큐브', '숫자', '', 'kim.test', '']]), cab([]));
    expect(r.games).toHaveLength(1);
    expect(r.games[0].recommendedPlayers).toBe('2명 ~ 4명');
    expect(r.duplicateGames).toEqual(['루미 큐브 (kim.test)']);
  });

  it('Unknown 보유자는 ownerUsername null, sourceKey에는 원래 ID', () => {
    const r = parseBoardGames(inv([['딕싯', '파티', '', 'gone.user', '']]), cab([]));
    expect(r.games[0]).toMatchObject({ ownerUsername: null, sourceKey: '딕싯:gone.user' });
  });

  it('보유자가 비어 있으면 sourceKey 접미사는 none', () => {
    const r = parseBoardGames(inv([['체스', '전략', '2명', '', '비고 있음']]), cab([]));
    expect(r.games[0]).toMatchObject({ ownerUsername: null, sourceKey: '체스:none', note: '비고 있음' });
  });
});

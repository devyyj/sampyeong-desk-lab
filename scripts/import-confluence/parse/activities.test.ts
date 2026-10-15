// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { classifyActivity, parseActivities } from './activities';
import type { ConfluencePage } from '../types';

const row = (date: string | null, content: string, note: string) =>
  `<tr><td class="numberingColumn">1</td>` +
  `<td><div class="content-wrapper"><p>${date ? `<time datetime="${date}">표시용</time>` : '날짜 없음'}</p></div></td>` +
  `<td>${content}</td><td>${note}</td></tr>`;
const page = (id: string, ...rows: string[]): ConfluencePage => ({
  id, title: '시즌 1 (25년 4분기)', parents: [],
  html: `<table><tbody><tr><th class="numberingColumn"></th><th>날짜</th><th>내용</th><th>비고</th></tr>${rows.join('')}</tbody></table>`,
});
const img = (name: string) => `<span class="confluence-embedded-file-wrapper"><img src="https://h/download/attachments/embedded-page/~s/t/${name}?api=v2"></span>`;

describe('classifyActivity', () => {
  it('우선순위: 방탈출 → 정기 → 점심 → 저녁 → 그 외', () => {
    expect(classifyActivity('제 6회 방탈출 정기모임')).toBe('ESCAPE_ROOM');
    expect(classifyActivity('제 3회 보드게임 정기모임')).toBe('REGULAR');
    expect(classifyActivity('점심 전략 연구')).toBe('LUNCH');
    expect(classifyActivity('저녁 연구')).toBe('EVENING');
    expect(classifyActivity('번개 모임')).toBe('OTHER');
  });
});

describe('parseActivities', () => {
  it('제목·날짜·본문, 사진은 내용→비고 문서 순서, 비고에서 버튼과 이미지 제거', () => {
    const [a] = parseActivities(page('p1', row(
      '2025-12-19',
      '<ul><li><strong>제 2회 방탈출 정기모임</strong></li><li>인원 : 4명</li></ul>',
      `<div class="expand-container"><button><span>활동 사진</span></button>${img('b.png')}${img('a.png')}</div><ul><li>후기</li></ul>`,
    )), 1);

    expect(a).toMatchObject({ sourceKey: 'p1:1', seasonId: 1, date: '2025-12-19', type: 'ESCAPE_ROOM', title: '제 2회 방탈출 정기모임', noteMd: '- 후기' });
    expect(a.bodyMd).toBe('- **제 2회 방탈출 정기모임**\n- 인원 : 4명');
    expect(a.photos).toEqual([
      { pageId: 'p1', fileName: 'b.png', position: 0 },
      { pageId: 'p1', fileName: 'a.png', position: 1 },
    ]);
  });

  it('내용 셀의 사진이 비고 셀 사진보다 앞 순서', () => {
    const [a] = parseActivities(page('p1', row('2025-12-19', `<p>점심 연구</p>${img('c.png')}`, img('d.png'))), 1);
    expect(a.photos.map((p) => p.fileName)).toEqual(['c.png', 'd.png']);
  });

  it('사진/비고 없는 행 → photos [], noteMd null', () => {
    const [a] = parseActivities(page('p1', row('2026-01-05', '<ul><li>점심 연구</li></ul>', '<br/>')), 2);
    expect(a.photos).toEqual([]);
    expect(a.noteMd).toBeNull();
  });

  it('하위 목록이 있는 li의 제목은 자기 텍스트만', () => {
    const [a] = parseActivities(page('p1', row('2026-01-05', '<ul><li>점심 연구<ul><li>5명</li></ul></li></ul>', '')), 2);
    expect(a.title).toBe('점심 연구');
    expect(a.type).toBe('LUNCH');
  });

  it('li가 없으면 내용 텍스트 첫 줄이 제목', () => {
    const [a] = parseActivities(page('p1', row('2026-01-05', '<p>저녁 모임</p><p>둘째 줄</p>', '')), 2);
    expect(a.title).toBe('저녁 모임');
  });

  it('행 번호로 sourceKey를 만든다(1부터)', () => {
    const list = parseActivities(page('p9', row('2026-01-05', '<p>a</p>', ''), row('2026-01-06', '<p>b</p>', '')), 2);
    expect(list.map((a) => a.sourceKey)).toEqual(['p9:1', 'p9:2']);
  });

  it('date 없는 행은 페이지/행 정보를 담아 throw', () => {
    expect(() => parseActivities(page('p1', row(null, '<p>a</p>', '')), 1)).toThrow('p1 row 1: date missing');
  });
});

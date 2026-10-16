// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { markdownToPlain, activityContent } from './markdown-plain';

describe('markdownToPlain (활동 기록 이관용: 읽기 좋은 일반 텍스트)', () => {
  it('들여쓰기 목록을 단계별 글머리표와 3칸 들여쓰기로 바꾼다(공백 4칸 = 한 단계)', () => {
    const md = ['- 테마', '    - 비트포비아 강남던전', '        - 로스트 킹덤 (3명)', '            - 4단계'].join('\n');
    expect(markdownToPlain(md)).toBe(['• 테마', '   ◦ 비트포비아 강남던전', '      ▪ 로스트 킹덤 (3명)', '         ▫ 4단계'].join('\n'));
  });

  it('굵게·기울임 기호를 지운다', () => {
    expect(markdownToPlain('- 인원 : **15명 🔥**')).toBe('• 인원 : 15명 🔥');
    expect(markdownToPlain('- **인원 : 10명 🐙**')).toBe('• 인원 : 10명 🐙');
    expect(markdownToPlain('- 🏯 백로성 (The White Castle) — *Weight ≈ 3.0*')).toBe('• 🏯 백로성 (The White Castle) — Weight ≈ 3.0');
  });

  it('이스케이프 문자는 원래 문자로 되돌린다', () => {
    expect(markdownToPlain('        - <작성요망\\>')).toBe('      ▪ <작성요망>');
    expect(markdownToPlain('\\*저희 친합니다... 진짜로...')).toBe('*저희 친합니다... 진짜로...');
  });

  it('제목 기호(#)를 지우고, 줄 끝의 Markdown 줄바꿈 공백을 정리한다', () => {
    expect(markdownToPlain('# 🥸🤡🤓')).toBe('🥸🤡🤓');
    expect(markdownToPlain('- 백로성  ')).toBe('• 백로성');
  });

  it('연속 빈 줄은 하나로, 앞뒤 빈 줄은 없앤다', () => {
    expect(markdownToPlain('\n\n첫 줄\n\n\n\n- 둘째\n\n')).toBe('첫 줄\n\n• 둘째');
  });

  it('목록이 아닌 일반 문장은 그대로 둔다', () => {
    expect(markdownToPlain('그냥 문장입니다 🐔')).toBe('그냥 문장입니다 🐔');
  });
});

describe('activityContent (활동 → 게시글 본문)', () => {
  const body = [
    '- **제 7회 방탈출 정기모임**',
    '    - 테마',
    '        - 비트포비아 강남던전',
    '    - 식사',
    '        - 꼬끼오 장작92',
  ].join('\n');

  it('본문 첫 줄이 제목과 같으면 그 줄을 빼고 하위 항목을 한 단계 올린다(제목은 따로 굵게 보여주므로)', () => {
    expect(activityContent('제 7회 방탈출 정기모임', body, null)).toBe(
      ['• 테마', '   ◦ 비트포비아 강남던전', '• 식사', '   ◦ 꼬끼오 장작92'].join('\n'),
    );
  });

  it('첫 줄이 제목과 다르면 그대로 둔다', () => {
    expect(activityContent('다른 제목', '- 인원 : 7명', null)).toBe('• 인원 : 7명');
  });

  it('후기가 있으면 구분선 아래에 붙인다', () => {
    const note = '\\*저희 친합니다...\n\n- 로스트 킹덤\n    - 열심히 기어 다녔다';
    expect(activityContent('제 7회 방탈출 정기모임', body, note)).toBe(
      [
        '• 테마',
        '   ◦ 비트포비아 강남던전',
        '• 식사',
        '   ◦ 꼬끼오 장작92',
        '',
        '─── 후기 ───',
        '*저희 친합니다...',
        '',
        '• 로스트 킹덤',
        '   ◦ 열심히 기어 다녔다',
      ].join('\n'),
    );
  });

  it('빈 후기(공백만)는 붙이지 않는다', () => {
    expect(activityContent('t', '- a', '   \n ')).toBe('• a');
  });

  it('제목 줄만 있는 본문이면 빈 문자열', () => {
    expect(activityContent('제 1회 보드게임 정기모임', '**제 1회 보드게임 정기모임**', null)).toBe('');
  });
});

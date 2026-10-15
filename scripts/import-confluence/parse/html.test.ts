// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseFragment, tableRows, attachmentName, toMarkdown } from './html';

describe('tableRows', () => {
  it('헤더 행과 numberingColumn 셀을 제외한 셀 배열', () => {
    const root = parseFragment(
      '<table><tbody><tr><th class="numberingColumn"></th><th>A</th></tr>' +
      '<tr><td class="numberingColumn">1</td><td>x</td></tr></tbody></table>',
    );
    expect(tableRows(root).map((r) => r.map((c) => c.textContent))).toEqual([['x']]);
  });

  it('root가 table 요소 자체면 그 표를 사용', () => {
    const root = parseFragment('<table><tbody><tr><td>first</td></tr></tbody></table><table><tbody><tr><td>last</td></tr></tbody></table>');
    const last = [...root.querySelectorAll('table')].at(-1)!;
    expect(tableRows(last).map((r) => r.map((c) => c.textContent))).toEqual([['last']]);
  });

  it('셀 안의 중첩 표 행은 바깥 표의 행으로 세지 않음', () => {
    const root = parseFragment(
      '<table><tbody><tr><th>A</th></tr><tr><td><table><tbody><tr><td>in</td></tr></tbody></table></td></tr></tbody></table>',
    );
    expect(tableRows(root)).toHaveLength(1);
  });
});

describe('attachmentName', () => {
  it('embedded-page 경로와 쿼리스트링을 처리하고 디코드', () => {
    expect(attachmentName('https://h/download/attachments/embedded-page/~a/%EC%8B%9C%EC%A6%8C/image-1.png?api=v2')).toBe('image-1.png');
    expect(attachmentName('/download/attachments/123/%ED%95%9C%EA%B8%80.jpg?version=1')).toBe('한글.jpg');
  });

  it('첨부가 아니면 null', () => {
    expect(attachmentName('/images/icons/emoticons/smile.svg')).toBeNull();
  });
});

describe('toMarkdown', () => {
  it('time은 datetime, button 제거, 멘션은 텍스트, 첨부 이미지는 콜백 결과', () => {
    const md = toMarkdown(
      parseFragment(
        '<p><time datetime="2026-01-02">2일</time><button>활동 사진</button>' +
        '<a class="confluence-userlink" data-username="kim.test" href="https://docs/x">김테스트/개발팀</a>' +
        '<img src="/download/attachments/1/a.png"></p>',
      ),
      { image: (f) => `[[${f}]]` },
    );
    expect(md).toBe('2026-01-02김테스트/개발팀[[a.png]]');
  });

  it('image 콜백이 없으면 첨부 이미지는 제거, 이모티콘은 alt로', () => {
    const md = toMarkdown(parseFragment('<p>a<img src="/download/attachments/1/a.png"><img class="emoticon" src="/images/icons/emoticons/smile.svg" alt="(smile)">b</p>'));
    expect(md).toBe('a(smile)b');
  });

  it('목록 기호 뒤 공백 1칸, 중첩 들여쓰기 유지', () => {
    expect(toMarkdown(parseFragment('<ul><li>a<ul><li>b</li></ul></li></ul>'))).toBe('- a\n    - b');
  });

  it('숨김 블록, 페이지 트리, 목차 매크로 제거', () => {
    const md = toMarkdown(parseFragment('<p>본문</p><p class="hidden">{}</p><div class="plugin_pagetree">트리</div><div class="toc-macro">목차</div>'));
    expect(md).toBe('본문');
  });
});

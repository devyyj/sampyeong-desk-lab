// Confluence export_view HTML을 다루는 저수준 헬퍼.
// 파서들은 정규식 대신 DOM(linkedom)으로 표/셀/멘션을 찾는다. Confluence HTML은 속성 순서와
// 중첩 구조(content-wrapper, expand-container 등)가 페이지마다 달라 정규식으로는 깨지기 쉽기 때문이다.
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';

/** HTML 조각을 파싱해 그 내용을 담은 컨테이너 요소를 돌려준다. */
export function parseFragment(html: string): HTMLElement {
  const { document } = parseHTML(`<!doctype html><html><body><div id="root">${html}</div></body></html>`);
  return document.getElementById('root') as HTMLElement;
}

/**
 * root 안 첫 번째 표의 데이터 행들을 셀 배열로 돌려준다.
 * - 헤더 행(th만 있는 행)은 제외한다.
 * - Confluence가 자동으로 붙이는 번호 열(numberingColumn)은 제외한다.
 * - 셀 안에 중첩된 표의 행은 바깥 표의 행으로 세지 않는다.
 * root가 table 요소 자체면 그 표를 쓴다(페이지의 첫 표가 아닌 특정 표를 고를 때).
 */
export function tableRows(root: Element): Element[][] {
  const table = root.tagName === 'TABLE' ? root : root.querySelector('table');
  if (!table) return [];
  const rows = [...table.querySelectorAll('tr')].filter((tr) => tr.closest('table') === table);
  return rows
    .map((tr) => [...tr.children].filter((c) => /^T[DH]$/.test(c.tagName) && !c.classList.contains('numberingColumn')))
    .filter((cells) => cells.length > 0 && !cells.every((c) => c.tagName === 'TH'));
}

/**
 * 첨부 파일 URL에서 파일명을 뽑는다.
 * 형식이 두 가지라 마지막 경로 조각만 쓴다:
 *   /download/attachments/<pageId>/<name>?...
 *   /download/attachments/embedded-page/<space>/<pageTitle>/<name>?...
 */
export function attachmentName(src: string): string | null {
  const m = src.match(/\/download\/(?:attachments|thumbnails)\/[^?#]*?([^/?#]+)(?:[?#]|$)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const isEmoticon = (img: Element) =>
  img.classList.contains('emoticon') || (img.getAttribute('src') ?? '').includes('/images/icons/');

const REMOVED_CLASSES = ['hidden', 'plugin_pagetree', 'toc-macro'];

/** 노드를 Markdown으로 변환한다. 첨부 이미지는 opts.image가 있으면 그 결과로, 없으면 제거한다. */
export function toMarkdown(node: Element, opts: { image?: (fileName: string, alt: string) => string } = {}): string {
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*' });

  td.remove(['style', 'script', 'colgroup', 'fieldset', 'input', 'button']);
  td.addRule('removedBlocks', {
    filter: (n) => REMOVED_CLASSES.some((c) => n.classList?.contains(c)),
    replacement: () => '',
  });
  // 날짜 매크로는 표시 문자열("19 Dec 2025")이 로케일마다 달라 datetime 속성(ISO)을 쓴다.
  td.addRule('time', { filter: 'time', replacement: (_, n) => (n as Element).getAttribute('datetime') ?? n.textContent ?? '' });
  // 사용자 멘션: Confluence 프로필 URL은 이관 후 의미가 없으므로 "이름/부서" 텍스트만 남긴다.
  td.addRule('mention', {
    filter: (n) => n.nodeName === 'A' && n.classList.contains('confluence-userlink'),
    replacement: (_, n) => n.textContent ?? '',
  });
  td.addRule('img', {
    filter: 'img',
    replacement: (_, n) => {
      const img = n as Element;
      if (isEmoticon(img)) return img.getAttribute('alt') ?? '';
      const fileName = attachmentName(img.getAttribute('src') ?? '');
      if (!fileName || !opts.image) return '';
      return opts.image(fileName, (img.getAttribute('alt') ?? '').replace(/[[\]]/g, ''));
    },
  });

  return td
    .turndown(node as unknown as HTMLElement)
    // turndown 기본 목록 표기 "-   a"를 "- a"로 정규화 (중첩 들여쓰기는 유지)
    .replace(/^(\s*)([-*]|\d+\.) {2,}/gm, '$1$2 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

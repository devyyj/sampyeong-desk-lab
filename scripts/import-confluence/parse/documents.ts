import type { ConfluencePage, ParsedDocument } from '../types';
import { parseFragment, toMarkdown } from './html';

/**
 * 문서 본문 속 이미지 자리 표시자. 파싱 시점에는 Storage public URL을 모르므로 파일명만 남겨 두고,
 * load 단계에서 업로드 결과 URL로 치환한다.
 */
export const IMG_PLACEHOLDER = (fileName: string) => `{{img:${fileName}}}`;

// 보관함 페이지의 이 섹션은 board_games(in_shared_cabinet)로 이관되므로 문서 본문에서는 뺀다.
const CABINET_LIST_HEADING = '보관중인 게임 목록';

/** root의 직계 자식 중 node를 포함하는 요소 */
function topLevelOf(root: Element, node: Element): Element {
  let cur = node;
  while (cur.parentElement && cur.parentElement !== root) cur = cur.parentElement;
  return cur;
}

/** 서술형 페이지(회칙, 공용 보관함 안내)를 Markdown 문서로 바꾼다. */
export function parseDocument(slug: ParsedDocument['slug'], page: ConfluencePage): ParsedDocument {
  const root = parseFragment(page.html);

  if (slug === 'shared-cabinet') {
    // 목차 매크로(<li>)에도 같은 문구가 있으므로 헤딩 요소에서만 찾는다.
    const heading = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .find((h) => (h.textContent ?? '').includes(CABINET_LIST_HEADING));
    if (heading) {
      let cur: Element | null = topLevelOf(root, heading);
      while (cur) {
        const next: Element | null = cur.nextElementSibling;
        cur.remove();
        cur = next;
      }
    }
  }

  const images: ParsedDocument['images'] = [];
  const bodyMd = toMarkdown(root, {
    image: (fileName, alt) => {
      images.push({ pageId: page.id, fileName });
      return `![${alt}](${IMG_PLACEHOLDER(fileName)})`;
    },
  });

  return { slug, title: page.title, bodyMd, sourcePageId: page.id, images };
}

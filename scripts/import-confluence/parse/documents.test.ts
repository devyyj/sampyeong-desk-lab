// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseDocument, IMG_PLACEHOLDER } from './documents';
import type { ConfluencePage } from '../types';

const page = (id: string, title: string, html: string): ConfluencePage => ({ id, title, parents: [], html });
const img = (name: string) => `<span class="confluence-embedded-file-wrapper"><img src="https://h/download/attachments/embedded-page/~s/t/${name}?api=v2"></span>`;
const toc = '<div class="toc-macro"><ul><li><a href="#a">1. 위치</a></li><li><a href="#b">3. 보관중인 게임 목록</a></li></ul></div>';

describe('IMG_PLACEHOLDER', () => {
  it('파일명을 감싼 치환 토큰', () => {
    expect(IMG_PLACEHOLDER('m.png')).toBe('{{img:m.png}}');
  });
});

describe('parseDocument', () => {
  it('shared-cabinet: 목차 매크로 속 같은 문구는 무시하고, 본문의 게임 목록 헤딩부터 끝까지 제거', () => {
    const d = parseDocument('shared-cabinet', page('c1', '공용 보드 게임 보관함🎁',
      `<p>${toc}</p><h1>1. 위치</h1><p>${img('m.png')}</p><h1>3. 보관중인 게임 목록</h1><table><tbody><tr><td>게임</td></tr></tbody></table>`));

    expect(d.bodyMd).toBe('# 1\\. 위치\n\n![]({{img:m.png}})');
    expect(d.images).toEqual([{ pageId: 'c1', fileName: 'm.png' }]);
    expect(d).toMatchObject({ slug: 'shared-cabinet', title: '공용 보드 게임 보관함🎁', sourcePageId: 'c1' });
  });

  it('rules: 전체 본문, 목차 매크로 제거, 이미지 순서 기록', () => {
    const d = parseDocument('rules', page('r1', '회칙👑', `${toc}<h1>1. 이름</h1><p>${img('a.png')}${img('b.png')}</p><p>본문</p>`));
    expect(d.bodyMd).toBe('# 1\\. 이름\n\n![]({{img:a.png}})![]({{img:b.png}})\n\n본문');
    expect(d.images.map((i) => i.fileName)).toEqual(['a.png', 'b.png']);
  });
});

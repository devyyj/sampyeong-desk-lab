import type { ActivityType, ConfluencePage, ParsedActivity, ParsedPhoto } from '../types';
import { attachmentName, parseFragment, tableRows, toMarkdown } from './html';

/**
 * 활동 제목으로 모임 종류를 분류한다.
 * "제 6회 방탈출 정기모임"처럼 키워드가 겹치는 제목이 있어 우선순위가 필요하다:
 * 방탈출 정기모임은 보드게임 정기모임과 다른 행사이므로 "방탈출"을 "정기"보다 먼저 본다.
 */
export function classifyActivity(title: string): ActivityType {
  if (title.includes('방탈출')) return 'ESCAPE_ROOM';
  if (title.includes('정기')) return 'REGULAR';
  if (title.includes('점심')) return 'LUNCH';
  if (title.includes('저녁')) return 'EVENING';
  return 'OTHER';
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 내용 셀의 첫 최상위 목록 항목의 "자기 텍스트"(하위 목록 제외). 목록이 없으면 첫 텍스트 블록. */
function titleOf(content: Element): string {
  const li = content.querySelector('ul > li, ol > li');
  if (li) {
    const clone = li.cloneNode(true) as Element;
    clone.querySelectorAll('ul, ol').forEach((n) => n.remove());
    const text = squash(clone.textContent ?? '');
    if (text) return text;
  }
  const block = [...content.querySelectorAll('p, h1, h2, h3, h4, div')].find((el) => squash(el.textContent ?? ''));
  return squash(block?.textContent ?? content.textContent ?? '');
}

const photoNames = (cell: Element | undefined) =>
  [...(cell?.querySelectorAll('img') ?? [])]
    .filter((img) => !img.classList.contains('emoticon'))
    .map((img) => attachmentName(img.getAttribute('src') ?? ''))
    .filter((name): name is string => name !== null);

/**
 * 시즌 활동 페이지의 표([날짜, 내용, 비고])를 활동 레코드로 바꾼다.
 * 원문 형식이 행마다 달라 인원/게임/후기를 컬럼으로 쪼개지 않고(반정형), 제목·종류·날짜만 추출하고
 * 나머지는 Markdown으로 보존한다. 사진은 Markdown에서 빼고 photos로 따로 모은다(private 버킷 업로드용).
 */
export function parseActivities(page: ConfluencePage, seasonId: number): ParsedActivity[] {
  return tableRows(parseFragment(page.html)).map(([dateCell, contentCell, noteCell], i) => {
    const rowNo = i + 1;
    const date = dateCell?.querySelector('time')?.getAttribute('datetime');
    if (!date) throw new Error(`${page.id} row ${rowNo}: date missing`);

    const title = titleOf(contentCell);
    const photos: ParsedPhoto[] = [...photoNames(contentCell), ...photoNames(noteCell)]
      .map((fileName, position) => ({ pageId: page.id, fileName, position }));
    const noteMd = noteCell ? toMarkdown(noteCell) : '';

    return {
      // 행 번호 기반 키: 1회성 이관이라 원본 표가 더 바뀌지 않는다는 전제. 재실행 시 같은 행은 같은 레코드로 upsert된다.
      sourceKey: `${page.id}:${rowNo}`,
      seasonId,
      date,
      type: classifyActivity(title),
      title,
      bodyMd: toMarkdown(contentCell),
      noteMd: noteMd || null,
      photos,
    };
  });
}

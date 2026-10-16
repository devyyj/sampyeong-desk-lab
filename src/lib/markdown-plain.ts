/**
 * 활동 기록(Markdown) → 게시글(일반 텍스트) 변환. 피드·활동 데이터 통합 이관에서 한 번 쓴다.
 * 설계: docs/superpowers/specs/2026-10-16-feed-activity-merge-design.md §4.3 (②안: 읽기 좋은 일반 텍스트)
 *
 * 이관 대상 91건을 조사해 실제로 쓰인 문법만 다룬다: 들여쓰기 목록(공백 4칸 단위, 최대 4단계), **굵게**, *기울임*,
 * # 제목(이모지 한 줄), 백슬래시 이스케이프(\*, \>), 줄 끝 공백 2칸(Markdown 줄바꿈). 링크·이미지·표·번호 목록은 없다.
 * Markdown 파서를 쓰지 않고 줄 단위로 처리하는 이유: 목록의 들여쓰기 깊이를 그대로 글머리표 단계로 옮겨야 하는데,
 * 파서를 거치면 그 정보를 다시 계산해야 하고, 대상 문법이 이 정도로 단순해 직접 처리가 더 예측 가능하다.
 */

const BULLETS = ['•', '◦', '▪', '▫'];
const INDENT_UNIT = 4; // 원본 Markdown 한 단계 들여쓰기(공백 수)
const OUTPUT_INDENT = '   '; // 변환 결과 한 단계 들여쓰기(글머리표 폭에 맞춘 3칸)

// 이스케이프된 문자를 기호 처리에서 보호하려고 잠시 바꿔 두는 자리표시자(본문에 나올 일이 없는 문자 사용).
const ESCAPE_OPEN = '\u0000';
const ESCAPE_CLOSE = '\u0001';

function protectEscapes(line: string): string {
  return line.replace(/\\([\\`*_{}[\]()#+\-.!<>|~])/g, (_, ch: string) => `${ESCAPE_OPEN}${ch.charCodeAt(0)}${ESCAPE_CLOSE}`);
}

function restoreEscapes(line: string): string {
  return line.replace(new RegExp(`${ESCAPE_OPEN}(\\d+)${ESCAPE_CLOSE}`, 'g'), (_, code: string) => String.fromCharCode(Number(code)));
}

/** **굵게**, *기울임* 기호를 지운다(이스케이프된 별표는 보호된 상태라 건드리지 않는다). */
function stripEmphasis(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1$2');
}

function convertLine(raw: string): string {
  let line = protectEscapes(raw.replace(/\s+$/, ''));
  line = line.replace(/^ {0,3}#{1,6}\s+/, '');
  const list = /^( *)[-*+] +(.*)$/.exec(line);
  if (list) {
    const level = Math.min(BULLETS.length - 1, Math.floor(list[1].length / INDENT_UNIT));
    line = `${OUTPUT_INDENT.repeat(level)}${BULLETS[level]} ${stripEmphasis(list[2])}`;
  } else {
    line = stripEmphasis(line);
  }
  return restoreEscapes(line);
}

/** 연속 빈 줄은 하나로, 앞뒤 빈 줄은 없앤다. */
function tidy(lines: string[]): string {
  const out: string[] = [];
  for (const line of lines) {
    if (line.trim() === '' && (out.length === 0 || out[out.length - 1] === '')) continue;
    out.push(line.trim() === '' ? '' : line);
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

export function markdownToPlain(md: string): string {
  return tidy(md.split('\n').map(convertLine));
}

/** 줄 맨 앞의 목록·제목 기호와 강조 기호를 걷어 낸 "보이는 글자"(제목 비교용). */
function visibleText(line: string): string {
  return restoreEscapes(stripEmphasis(protectEscapes(line).replace(/^ *([-*+]|#{1,6}) +/, ''))).trim();
}

const indentOf = (line: string) => /^ */.exec(line)![0].length;

/**
 * 첫 줄이 제목과 같으면 그 줄을 빼고, 그 줄의 하위 항목들을 한 단계씩 올린다.
 * 게시글 카드는 제목(posts.title)을 따로 굵게 보여주므로 본문 첫 줄에 같은 제목이 또 나오면 중복이다.
 * (이관 대상 91건 모두 본문 첫 줄이 제목과 같다.)
 */
function dropTitleLine(title: string, md: string): string {
  const lines = md.split('\n');
  const first = lines.findIndex((l) => l.trim() !== '');
  if (first === -1 || visibleText(lines[first]) !== title.trim()) return md;

  const base = indentOf(lines[first]);
  const rest = lines.slice(first + 1);
  let inChildren = true;
  return rest
    .map((line) => {
      if (line.trim() === '') return line;
      // 제목 줄보다 깊이 들여쓴 연속 줄만 그 하위 항목이다. 같은 깊이의 줄이 나오면 그 뒤는 손대지 않는다.
      if (inChildren && indentOf(line) > base) return line.slice(INDENT_UNIT);
      inChildren = false;
      return line;
    })
    .join('\n');
}

/**
 * 활동 1건 → 게시글 본문. 본문(제목 줄 제외) 뒤에, 후기가 있으면 구분선 아래에 붙인다.
 * 종류·시즌·날짜·제목은 게시글의 별도 칼럼으로 옮기므로 본문에 넣지 않는다.
 */
export function activityContent(title: string, bodyMd: string, noteMd: string | null): string {
  const body = markdownToPlain(dropTitleLine(title, bodyMd));
  const note = noteMd && noteMd.trim() ? markdownToPlain(noteMd) : '';
  if (!note) return body;
  return body ? `${body}\n\n─── 후기 ───\n${note}` : `─── 후기 ───\n${note}`;
}

import type { Mention, ParsedBoardGame } from '../types';
import { parseFragment, tableRows } from './html';
import { parseMention } from './people';

/**
 * 게임 이름 비교용 정규화: 소문자 + 문자/숫자 외 모두 제거.
 * 보관함 표와 보유 현황 표의 띄어쓰기·기호가 다르게 적혀 있어("한밤의 늑대인간" vs "한밤의 늑대 인간") 필요하다.
 */
export function normalizeGameName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// Confluence 빈 셀은 &nbsp;나 공백만 들어 있는 경우가 많다.
const cellText = (cell: Element | undefined) => {
  const t = (cell?.textContent ?? '').replace(/ /g, ' ').trim();
  return t === '' ? null : t;
};

const ownerOf = (cell: Element | undefined): Mention | null => {
  const a = cell?.querySelector('a.confluence-userlink');
  return a ? parseMention(a) : null;
};

/**
 * 보유 현황 표와 공용 보관함 표를 합쳐 board_games 레코드를 만든다.
 * - 보유 현황 열: [이름, 카테고리, 플레이 인원, 보유자, 비고]
 * - 보관함 열: [이름, 소유자, 비고] — 보관함 페이지는 안내문 뒤 마지막 표가 게임 목록이다.
 * - 같은 게임 판정은 "정규화 이름 + 보유자 ID". 이름만 같고 주인이 다르면 다른 실물 게임이다.
 * - sourceKey는 import 재실행 시 upsert 기준이다. Unknown 보유자도 원래 ID를 넣어 키가 흔들리지 않게 한다.
 */
export function parseBoardGames(inventoryHtml: string, cabinetHtml: string): {
  games: ParsedBoardGame[]; ownerMentions: Mention[]; cabinetUnmatched: string[]; duplicateGames: string[];
} {
  const games = new Map<string, ParsedBoardGame>();
  const ownerMentions: Mention[] = [];
  const cabinetUnmatched: string[] = [];
  const duplicateGames: string[] = [];

  const keyOf = (name: string, owner: Mention | null) => `${normalizeGameName(name)}:${owner?.username ?? 'none'}`;
  const label = (name: string, owner: Mention | null) => `${name} (${owner?.username ?? 'none'})`;

  for (const [nameCell, categoryCell, playersCell, ownerCell, noteCell] of tableRows(parseFragment(inventoryHtml))) {
    const name = cellText(nameCell);
    if (!name) continue;
    const owner = ownerOf(ownerCell);
    if (owner) ownerMentions.push(owner);
    const sourceKey = keyOf(name, owner);
    if (games.has(sourceKey)) {
      duplicateGames.push(label(name, owner));
      continue;
    }
    games.set(sourceKey, {
      sourceKey, name,
      category: cellText(categoryCell),
      recommendedPlayers: cellText(playersCell),
      ownerUsername: owner && !owner.unknown ? owner.username : null,
      note: cellText(noteCell),
      inSharedCabinet: false,
    });
  }

  const cabinetTable = [...parseFragment(cabinetHtml).querySelectorAll('table')].at(-1);
  for (const [nameCell, ownerCell, noteCell] of cabinetTable ? tableRows(cabinetTable) : []) {
    const name = cellText(nameCell);
    if (!name) continue;
    const owner = ownerOf(ownerCell);
    if (owner) ownerMentions.push(owner);
    const sourceKey = keyOf(name, owner);
    const existing = games.get(sourceKey);
    if (existing) {
      existing.inSharedCabinet = true;
      existing.note ??= cellText(noteCell);
      continue;
    }
    // 보유 현황 표에 없는 보관함 게임: 버리지 않고 새 게임으로 추가하되, 사람이 확인하도록 리포트한다.
    cabinetUnmatched.push(label(name, owner));
    games.set(sourceKey, {
      sourceKey, name, category: null, recommendedPlayers: null,
      ownerUsername: owner && !owner.unknown ? owner.username : null,
      note: cellText(noteCell), inSharedCabinet: true,
    });
  }

  return { games: [...games.values()], ownerMentions, cabinetUnmatched, duplicateGames };
}

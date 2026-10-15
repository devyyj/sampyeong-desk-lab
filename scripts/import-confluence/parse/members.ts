import type { Mention, ParsedSeason, ParsedSeasonMember } from '../types';
import { parseFragment, tableRows } from './html';
import { parseMention } from './people';

/** 활동 페이지 제목 "시즌 5 (26년 4분기)🎄" → 시즌 정보. 명부 페이지 등 다른 제목이면 null. */
export function parseSeasonTitle(title: string): ParsedSeason | null {
  const m = title.match(/^시즌\s*(\d+)\s*\(([^)]+)\)/);
  return m ? { id: Number(m[1]), name: `시즌 ${m[1]}`, period: m[2].trim() } : null;
}

/** 명부 페이지 제목 "시즌 3 회원 명부" → 3 */
export function parseRosterTitle(title: string): number | null {
  const m = title.match(/^시즌\s*(\d+)\s*회원\s*명부/);
  return m ? Number(m[1]) : null;
}

/**
 * 시즌 명부 표([이름(멘션), 비고])를 파싱한다.
 * 비고에 "회장"이 있으면 role로 분리하고, 나머지(🎖️/💎 뱃지, 이모지 등)는 원문 그대로 note에 둔다.
 * 회장 표기가 <h1> 안에 들어간 시즌도 있어 textContent 기준으로 판단한다.
 */
export function parseRoster(seasonId: number, html: string): { members: ParsedSeasonMember[]; mentions: Mention[]; skippedUnknown: string[] } {
  const members: ParsedSeasonMember[] = [];
  const mentions: Mention[] = [];
  const skippedUnknown: string[] = [];

  for (const [nameCell, noteCell] of tableRows(parseFragment(html))) {
    const a = nameCell?.querySelector('a.confluence-userlink');
    if (!a) continue;
    const mention = parseMention(a);
    mentions.push(mention);
    if (mention.unknown) {
      skippedUnknown.push(mention.username);
      continue;
    }
    const text = (noteCell?.textContent ?? '').trim();
    const isPresident = text.includes('회장');
    const note = (isPresident ? text.replace('회장', '') : text).trim();
    members.push({ seasonId, username: mention.username, role: isPresident ? '회장' : null, note: note || null });
  }
  return { members, mentions, skippedUnknown };
}

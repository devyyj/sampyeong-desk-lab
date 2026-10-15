import type { ConfluencePage, Mention, Normalized } from './types';
import { parseSeasonTitle, parseRosterTitle, parseRoster } from './parse/members';
import { parseBoardGames } from './parse/boardgames';
import { parseActivities } from './parse/activities';
import { parseDocument } from './parse/documents';
import { collectPeople } from './parse/people';

function requirePage(pages: ConfluencePage[], titlePrefix: string): ConfluencePage {
  const page = pages.find((p) => p.title.startsWith(titlePrefix));
  if (!page) throw new Error(`필수 페이지 없음: ${titlePrefix}`);
  return page;
}

/**
 * 수집한 Confluence 페이지 전체를 DB 적재용 정규화 데이터로 바꾼다.
 * 페이지는 ID가 아닌 제목 패턴으로 찾는다(시즌 페이지가 추가돼도 코드 수정 없이 인식되도록).
 */
export function normalize(pages: ConfluencePage[]): Normalized {
  const activityPages = pages
    .map((page) => ({ page, season: parseSeasonTitle(page.title) }))
    .filter((x): x is { page: ConfluencePage; season: NonNullable<typeof x.season> } => x.season !== null)
    .sort((a, b) => a.season.id - b.season.id);

  // 명부는 최신 시즌부터: collectPeople이 먼저 나온 부서를 채택하므로 최신 부서가 남는다.
  const rosters = pages
    .map((page) => ({ page, seasonId: parseRosterTitle(page.title) }))
    .filter((x): x is { page: ConfluencePage; seasonId: number } => x.seasonId !== null)
    .sort((a, b) => b.seasonId - a.seasonId)
    .map(({ page, seasonId }) => parseRoster(seasonId, page.html));

  const cabinetPage = requirePage(pages, '공용 보드 게임 보관함');
  const games = parseBoardGames(requirePage(pages, '보드 게임 보유 현황').html, cabinetPage.html);
  const rulesPage = requirePage(pages, '회칙');

  // 명부 → 보드게임 보유자 순서. 명부에 없는 보유자(비회원 보유자)도 사전 등록 대상이다.
  const mentions: Mention[] = [...rosters.flatMap((r) => r.mentions), ...games.ownerMentions];
  const skippedUnknownUsers = [...new Set(mentions.filter((m) => m.unknown).map((m) => m.username))];

  return {
    people: collectPeople(mentions),
    seasons: activityPages.map((x) => x.season),
    seasonMembers: rosters.flatMap((r) => r.members),
    boardGames: games.games,
    activities: activityPages.flatMap(({ page, season }) => parseActivities(page, season.id)),
    documents: [parseDocument('rules', rulesPage), parseDocument('shared-cabinet', cabinetPage)],
    report: {
      skippedUnknownUsers,
      cabinetUnmatched: games.cabinetUnmatched,
      duplicateGames: games.duplicateGames,
      missingFiles: [], // 로컬 첨부 확인은 CLI(index.ts)에서 채운다
    },
  };
}

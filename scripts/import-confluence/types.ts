// Confluence import 파이프라인의 공용 타입.
// 파서(parse/*) → normalize → images/load 단계가 이 타입으로만 데이터를 주고받는다.

/** Confluence REST export_view로 수집한 페이지 원본 (data/confluence/pages.json의 원소) */
export type ConfluencePage = { id: string; title: string; parents: { id: string; title: string }[]; html: string };

/** 사용자 멘션 링크 하나를 해석한 결과. 퇴사자 등은 Confluence가 "Unknown User (id)"로 렌더링한다. */
export type Mention = { username: string; displayName: string | null; department: string | null; unknown: boolean };

/** users 테이블에 사전 등록할 사람 */
export type Person = { username: string; displayName: string; department: string };

export type ParsedSeason = { id: number; name: string; period: string };
export type ParsedSeasonMember = { seasonId: number; username: string; role: string | null; note: string | null };

export type ParsedBoardGame = {
  sourceKey: string;
  name: string;
  category: string | null;
  recommendedPlayers: string | null;
  ownerUsername: string | null;
  note: string | null;
  inSharedCabinet: boolean;
};

export type ParsedDocument = {
  slug: 'rules' | 'shared-cabinet';
  title: string;
  bodyMd: string;
  sourcePageId: string;
  images: { pageId: string; fileName: string }[];
};

export type ImportReport = {
  skippedUnknownUsers: string[];
  cabinetUnmatched: string[];
  duplicateGames: string[];
  missingFiles: string[];
};

export type Normalized = {
  people: Person[];
  seasons: ParsedSeason[];
  seasonMembers: ParsedSeasonMember[];
  boardGames: ParsedBoardGame[];
  documents: ParsedDocument[];
  report: ImportReport;
};

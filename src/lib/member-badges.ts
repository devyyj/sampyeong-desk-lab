import { inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { seasonMembers, seasons } from '../../drizzle/schema';
import type { MemberBadge } from './badge';

export type { MemberBadge } from './badge';

/**
 * 회원별 참여 시즌 수와 최신 시즌 회장 여부를 한 번의 쿼리로 센다(작성자·명단이 많은 화면에서 N+1을 피하려고).
 * 별도 테이블 없이 season_members에서 바로 센다: 행 수 = 참여 시즌 수.
 * "최신 시즌"은 id가 가장 큰 시즌이다(시즌 번호 순으로 id를 부여했다).
 */
async function querySeasonStats(ids: string[]) {
  return db
    .select({
      userId: seasonMembers.userId,
      seasonCount: sql<number>`count(*)::int`,
      isCurrentPresident: sql<boolean>`bool_or(${seasonMembers.seasonId} = (select max(${seasons.id}) from ${seasons}) and ${seasonMembers.role} = '회장')`,
    })
    .from(seasonMembers)
    .where(inArray(seasonMembers.userId, ids))
    .groupBy(seasonMembers.userId);
}

/**
 * 여러 회원의 배지(게시글·댓글 작성자 옆). 최신 시즌 회장은 회장, 그 외는 참여 시즌 수다.
 * 예전 시즌에만 회장이었다면 숫자 배지다. 참여 기록이 없는 회원은 Map에 넣지 않는다(배지 없음).
 */
export async function getMemberBadges(userIds: string[]): Promise<Map<string, MemberBadge>> {
  const ids = [...new Set(userIds)];
  const badges = new Map<string, MemberBadge>();
  if (ids.length === 0) return badges;

  for (const row of await querySeasonStats(ids)) {
    if (row.isCurrentPresident) badges.set(row.userId, { kind: 'president' });
    else if (row.seasonCount > 0) badges.set(row.userId, { kind: 'seasons', count: row.seasonCount });
  }
  return badges;
}

/**
 * 회원별 참여 시즌 수(기록이 없으면 0). 회원 명부는 고른 시즌의 직책(회장)을 그 시즌 기준으로 따로 표시하므로,
 * 최신 시즌 회장 여부로 숫자를 가리는 getMemberBadges 대신 숫자를 그대로 받는다.
 */
export async function getSeasonCounts(userIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(userIds)];
  const counts = new Map<string, number>(ids.map((id) => [id, 0]));
  if (ids.length === 0) return counts;

  for (const row of await querySeasonStats(ids)) counts.set(row.userId, row.seasonCount);
  return counts;
}

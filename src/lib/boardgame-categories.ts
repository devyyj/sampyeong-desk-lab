import { count, desc, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { boardGames } from '../../drizzle/schema';

/**
 * 지금 쓰는 보드게임 카테고리 목록(등록·수정 화면의 추천 목록용).
 * 많이 쓰는 분류를 먼저 찾도록 게임 수가 많은 순, 같으면 가나다순 — 목록 화면의 카테고리 시트와 같은 순서다.
 */
export async function getBoardGameCategories(): Promise<string[]> {
  const rows = await db
    .select({ category: boardGames.category, count: count() })
    .from(boardGames)
    .where(isNotNull(boardGames.category))
    .groupBy(boardGames.category)
    .orderBy(desc(count()));
  return rows
    .filter((r): r is { category: string; count: number } => Boolean(r.category))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, 'ko'))
    .map((r) => r.category);
}

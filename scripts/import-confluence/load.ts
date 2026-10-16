import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import * as schema from '../../drizzle/schema';
import { users, posts, boardGames, seasons, seasonMembers, documents } from '../../drizzle/schema';
import type { Normalized } from './types';

export type Db = PostgresJsDatabase<typeof schema>;

/** 이미지 업로드 결과. load는 이 값으로 문서 이미지 URL을 만든다. */
export type UploadedPaths = {
  documentImageUrls: Map<string /* slug */, Map<string /* fileName */, string /* public URL */>>;
};

// upsert 충돌 시 "새로 넣으려던 값"(EXCLUDED)으로 덮어쓰기 위한 헬퍼
const excluded = (column: string) => sql.raw(`excluded.${column}`);

/**
 * 사전 등록(미가입) 계정만 Confluence 값으로 갱신하고, 이미 가입한 회원의 값은 유지한다.
 * 가입 시 입력하거나 마이페이지에서 고친 부서를 재실행이 되돌리지 않게 하기 위함이다.
 * setWhere로 행 자체를 건너뛰면 RETURNING에서 빠져 userId 맵이 비고, 그 회원의 명부/보유 게임 연결이
 * 사라지므로 행은 항상 갱신(RETURNING 포함)하되 값만 조건부로 고른다.
 */
const keepIfRegistered = (column: string, current: AnyPgColumn) =>
  sql`CASE WHEN ${users.pinHash} IS NULL THEN ${excluded(column)} ELSE ${current} END`;

/**
 * --reset: FK 의존 순서(자식 → 부모)대로 비운다. 하나라도 실패하면 전부 롤백된다.
 * 주의: 활동 기록은 이제 게시글(posts)로만 남아 있고 이 스크립트가 다시 넣지 않으므로, 리셋하면 되살릴 수 없다.
 */
export async function resetDatabase(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of [seasonMembers, seasons, documents, boardGames, posts, users]) {
      await tx.delete(table);
    }
  });
}

// parse/documents.ts의 IMG_PLACEHOLDER("{{img:<file>}}")를 업로드된 public URL로 바꾼다.
function resolveDocumentImages(slug: string, bodyMd: string, urls: Map<string, string> | undefined): string {
  return bodyMd.replace(/\{\{img:([^}]+)\}\}/g, (_, fileName: string) => {
    const url = urls?.get(fileName);
    if (!url) throw new Error(`document ${slug}: 업로드된 이미지 URL 없음 (${fileName})`);
    return url;
  });
}

/**
 * 정규화 데이터를 한 트랜잭션으로 upsert한다. 재실행해도 같은 키의 행을 갱신할 뿐 중복을 만들지 않는다.
 * 중간에 실패하면 전체가 롤백되어, 일부만 들어간 어중간한 상태가 남지 않는다.
 */
export async function loadAll(db: Db, n: Normalized, uploaded: UploadedPaths): Promise<Record<string, number>> {
  return db.transaction(async (tx) => {
    // 사전 등록 계정. pinHash는 values/set 어디에도 넣지 않는다:
    // 이미 가입(claim)한 회원이 있는 상태에서 재실행해도 PIN이 지워지지 않게 하기 위함이다.
    // 닉네임도 새 행에만 아이디로 채우고 충돌 시 set에 넣지 않는다(회원이 바꾼 닉네임을 재실행이 덮어쓰지 않게).
    const userRows = n.people.length === 0 ? [] : await tx.insert(users)
      .values(n.people.map((p) => ({
        username: p.username, nickname: p.username.slice(0, 20), displayName: p.displayName, department: p.department,
      })))
      .onConflictDoUpdate({
        target: users.username,
        set: {
          displayName: keepIfRegistered('display_name', users.displayName),
          department: keepIfRegistered('department', users.department),
          updatedAt: new Date(),
        },
      })
      .returning({ id: users.id, username: users.username });
    const userId = new Map(userRows.map((u) => [u.username, u.id]));

    if (n.seasons.length) {
      await tx.insert(seasons).values(n.seasons)
        .onConflictDoUpdate({ target: seasons.id, set: { name: excluded('name'), period: excluded('period') } });
    }

    // Unknown User 등 people에 없는 사람의 명부 행은 연결할 계정이 없으므로 제외한다.
    const memberRows = n.seasonMembers
      .filter((m) => userId.has(m.username))
      .map((m) => ({ seasonId: m.seasonId, userId: userId.get(m.username)!, role: m.role, note: m.note }));
    if (memberRows.length) {
      await tx.insert(seasonMembers).values(memberRows)
        .onConflictDoUpdate({ target: [seasonMembers.seasonId, seasonMembers.userId], set: { role: excluded('role'), note: excluded('note') } });
    }

    if (n.boardGames.length) {
      await tx.insert(boardGames)
        .values(n.boardGames.map((g) => ({
          sourceKey: g.sourceKey, name: g.name, category: g.category, recommendedPlayers: g.recommendedPlayers,
          ownerId: g.ownerUsername ? userId.get(g.ownerUsername) ?? null : null,
          note: g.note, inSharedCabinet: g.inSharedCabinet,
        })))
        .onConflictDoUpdate({
          target: boardGames.sourceKey,
          set: {
            name: excluded('name'), category: excluded('category'), recommendedPlayers: excluded('recommended_players'),
            ownerId: excluded('owner_id'), note: excluded('note'), inSharedCabinet: excluded('in_shared_cabinet'), updatedAt: new Date(),
          },
        });
    }

    const documentRows = n.documents.map((d) => ({
      slug: d.slug, title: d.title, sourcePageId: d.sourcePageId,
      bodyMd: resolveDocumentImages(d.slug, d.bodyMd, uploaded.documentImageUrls.get(d.slug)),
    }));
    if (documentRows.length) {
      await tx.insert(documents).values(documentRows)
        .onConflictDoUpdate({
          target: documents.slug,
          set: { title: excluded('title'), bodyMd: excluded('body_md'), sourcePageId: excluded('source_page_id'), updatedAt: new Date() },
        });
    }

    return {
      users: userRows.length, seasons: n.seasons.length, seasonMembers: memberRows.length, boardGames: n.boardGames.length,
      documents: documentRows.length,
    };
  });
}

// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { getTableName, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { users, boardGames, documents, activities, activityPhotos, seasonMembers, seasons, posts } from '../../drizzle/schema';
import { loadAll, resetDatabase, type Db, type UploadedPaths } from './load';
import type { Normalized } from './types';

type Call = { table: unknown; values: Record<string, unknown>[]; onConflict?: { target: unknown; set: Record<string, unknown> } };

/**
 * drizzle 트랜잭션을 흉내 낸 가짜 DB. insert/delete 호출을 테이블별로 기록하고,
 * returning()에는 users/activities에 대해 결정적인 id를 돌려준다.
 */
function fakeDb() {
  const calls: Call[] = [];
  const deletes: unknown[] = [];
  let inTransaction = false;
  const outsideTx = vi.fn();

  const tx = {
    insert: (table: unknown) => {
      if (!inTransaction) outsideTx();
      const call: Call = { table, values: [] };
      calls.push(call);
      const rows = () => call.values.map((v) =>
        table === users ? { id: `id-${v.username}`, username: v.username }
          : table === activities ? { id: `act-${v.sourceKey}`, sourceKey: v.sourceKey } : v);
      const builder = {
        values: (v: Record<string, unknown>[]) => { call.values = v; return builder; },
        onConflictDoUpdate: (cfg: Call['onConflict']) => { call.onConflict = cfg; return builder; },
        returning: async () => rows(),
        then: (resolve: (x: unknown) => void) => resolve(undefined),
      };
      return builder;
    },
    delete: (table: unknown) => { if (!inTransaction) outsideTx(); deletes.push(table); return Promise.resolve(); },
  };
  const db = {
    transaction: async (cb: (t: typeof tx) => Promise<unknown>) => { inTransaction = true; try { return await cb(tx); } finally { inTransaction = false; } },
  } as unknown as Db;
  return { db, calls, deletes, outsideTx, callFor: (table: unknown) => calls.find((c) => c.table === table)! };
}

const normalized = (): Normalized => ({
  people: [{ username: 'kim.test', displayName: '김테스트', department: 'A팀' }],
  seasons: [{ id: 1, name: '시즌 1', period: '25년 4분기' }],
  seasonMembers: [{ seasonId: 1, username: 'kim.test', role: '회장', note: null }],
  boardGames: [
    { sourceKey: '딕싯:kim.test', name: '딕싯', category: '파티', recommendedPlayers: null, ownerUsername: 'kim.test', note: null, inSharedCabinet: true },
    { sourceKey: '체스:gone.user', name: '체스', category: null, recommendedPlayers: null, ownerUsername: null, note: null, inSharedCabinet: false },
  ],
  activities: [{ sourceKey: 'p1:1', seasonId: 1, date: '2025-12-19', type: 'LUNCH', title: '점심 연구', bodyMd: '- 점심 연구', noteMd: null, photos: [] }],
  documents: [{ slug: 'rules', title: '회칙', bodyMd: '![]({{img:a.png}})', sourcePageId: 'r1', images: [{ pageId: 'r1', fileName: 'a.png' }] }],
  report: { skippedUnknownUsers: [], cabinetUnmatched: [], duplicateGames: [], missingFiles: [] },
});
const uploaded = (): UploadedPaths => ({
  activityPhotos: new Map([['p1:1', [{ position: 0, storagePath: '1/p1_1/0.webp' }]]]),
  documentImageUrls: new Map([['rules', new Map([['a.png', 'https://s/document_images/rules/0.webp']])]]),
});

describe('loadAll', () => {
  it('users upsert는 username 기준이고, 충돌 시 set에 pinHash가 없다(가입자 PIN 보존)', async () => {
    const { db, callFor } = fakeDb();
    await loadAll(db, normalized(), uploaded());
    const call = callFor(users);
    expect(call.onConflict!.target).toBe(users.username);
    expect(Object.keys(call.onConflict!.set)).not.toContain('pinHash');
    expect(call.values[0]).not.toHaveProperty('pinHash');
  });

  it('가입한 회원(pin_hash 있음)의 부서·이름은 재실행 시 덮어쓰지 않는다', async () => {
    const { db, callFor } = fakeDb();
    await loadAll(db, normalized(), uploaded());
    const { set } = callFor(users).onConflict!;
    const render = (v: unknown) => new PgDialect().sqlToQuery(v as SQL).sql.toLowerCase();
    for (const column of ['department', 'displayName']) {
      // CASE WHEN pin_hash IS NULL THEN excluded.* ELSE 기존 값 END 형태여야 한다
      expect(render(set[column])).toMatch(/case when "users"\."pin_hash" is null then excluded\.\w+ else "users"\."\w+" end/);
    }
  });

  it('board_games.ownerId는 username→id 맵으로, 보유자 없는 게임은 null', async () => {
    const { db, callFor } = fakeDb();
    await loadAll(db, normalized(), uploaded());
    expect(callFor(boardGames).values.map((v) => v.ownerId)).toEqual(['id-kim.test', null]);
    expect(callFor(boardGames).onConflict!.target).toBe(boardGames.sourceKey);
  });

  it('season_members와 activity_photos는 반환된 id로 연결', async () => {
    const { db, callFor } = fakeDb();
    await loadAll(db, normalized(), uploaded());
    expect(callFor(seasonMembers).values).toEqual([{ seasonId: 1, userId: 'id-kim.test', role: '회장', note: null }]);
    expect(callFor(activityPhotos).values).toEqual([{ activityId: 'act-p1:1', position: 0, storagePath: '1/p1_1/0.webp' }]);
  });

  it('documents bodyMd의 이미지 placeholder를 public URL로 치환', async () => {
    const { db, callFor } = fakeDb();
    await loadAll(db, normalized(), uploaded());
    expect(callFor(documents).values[0].bodyMd).toBe('![](https://s/document_images/rules/0.webp)');
  });

  it('치환할 URL이 없으면 throw', async () => {
    const { db } = fakeDb();
    const up = uploaded();
    up.documentImageUrls = new Map();
    await expect(loadAll(db, normalized(), up)).rejects.toThrow('a.png');
  });

  it('모든 쓰기는 transaction 안에서 수행하고 테이블별 건수를 반환', async () => {
    const { db, outsideTx } = fakeDb();
    const counts = await loadAll(db, normalized(), uploaded());
    expect(outsideTx).not.toHaveBeenCalled();
    expect(counts).toEqual({ users: 1, seasons: 1, seasonMembers: 1, boardGames: 2, activities: 1, activityPhotos: 1, documents: 1 });
  });
});

describe('resetDatabase', () => {
  it('FK 의존 순서대로 한 트랜잭션에서 삭제', async () => {
    const { db, deletes, outsideTx } = fakeDb();
    await resetDatabase(db);
    expect(deletes.map((t) => getTableName(t as typeof users))).toEqual(
      [activityPhotos, activities, seasonMembers, seasons, documents, boardGames, posts, users].map((t) => getTableName(t)),
    );
    expect(outsideTx).not.toHaveBeenCalled();
  });
});

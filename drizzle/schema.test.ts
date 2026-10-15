// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { users, boardGames, activities, activityPhotos, seasonMembers, seasons, documents } from './schema';

const column = (table: Parameters<typeof getTableConfig>[0], name: string) =>
  getTableConfig(table).columns.find((c) => c.name === name)!;

describe('schema: Confluence import 확장', () => {
  it('users.pin_hash는 사전 등록(미가입)을 위해 nullable', () => {
    expect(column(users, 'pin_hash').notNull).toBe(false);
    expect(column(users, 'display_name')).toBeDefined();
  });

  it('board_games에 보유자/보관함/멱등성 키 컬럼이 있다', () => {
    expect(column(boardGames, 'source_key').isUnique).toBe(true);
    expect(column(boardGames, 'in_shared_cabinet').default).toBe(false);
    expect(column(boardGames, 'owner_id')).toBeDefined();
    expect(column(boardGames, 'category')).toBeDefined();
    expect(column(boardGames, 'note')).toBeDefined();
  });

  it('신규 테이블의 키 구성', () => {
    expect(column(activities, 'source_key').isUnique).toBe(true);
    expect(getTableConfig(seasonMembers).primaryKeys[0].columns.map((c) => c.name)).toEqual(['season_id', 'user_id']);
    expect(getTableConfig(activityPhotos).uniqueConstraints[0].columns.map((c) => c.name)).toEqual(['activity_id', 'position']);
    expect(column(seasons, 'id').primary).toBe(true);
    expect(column(documents, 'slug').primary).toBe(true);
  });
});

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  users, boardGames, activities, activityPhotos, seasonMembers, seasons, documents,
  posts, postImages, comments, postLikes, activityLikes, commentLikes,
} from './schema';

const column = (table: Parameters<typeof getTableConfig>[0], name: string) =>
  getTableConfig(table).columns.find((c) => c.name === name)!;

describe('schema: Confluence import 확장', () => {
  it('users.pin_hash는 사전 등록(미가입)을 위해 nullable', () => {
    expect(column(users, 'pin_hash').notNull).toBe(false);
    expect(column(users, 'display_name')).toBeDefined();
  });

  it('users에 관리자/PIN 변경 필요 플래그(기본 false)', () => {
    expect(column(users, 'is_admin')).toMatchObject({ notNull: true, default: false });
    expect(column(users, 'must_change_pin')).toMatchObject({ notNull: true, default: false });
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

describe('schema: 커뮤니티 기능(0005)', () => {
  it('users.nickname은 필수 varchar(20)', () => {
    expect(column(users, 'nickname')).toMatchObject({ notNull: true, length: 20 });
  });

  it('post_images는 게시글별 사진 순서가 겹치지 않는다', () => {
    expect(column(postImages, 'storage_path').notNull).toBe(true);
    expect(getTableConfig(postImages).uniqueConstraints[0].columns.map((c) => c.name)).toEqual(['post_id', 'position']);
  });

  it('comments는 게시글/활동 중 하나를 가리키고(CHECK), 작성자가 필수', () => {
    expect(column(comments, 'post_id').notNull).toBe(false);
    expect(column(comments, 'activity_id').notNull).toBe(false);
    expect(column(comments, 'author_id').notNull).toBe(true);
    expect(getTableConfig(comments).checks.map((c) => c.name)).toContain('comments_one_target');
  });

  it('좋아요 테이블은 (대상, 회원) 복합 PK로 회원당 1회만 허용', () => {
    expect(getTableConfig(postLikes).primaryKeys[0].columns.map((c) => c.name)).toEqual(['post_id', 'user_id']);
    expect(getTableConfig(activityLikes).primaryKeys[0].columns.map((c) => c.name)).toEqual(['activity_id', 'user_id']);
    expect(getTableConfig(commentLikes).primaryKeys[0].columns.map((c) => c.name)).toEqual(['comment_id', 'user_id']);
  });
});

describe('schema: 피드·활동 통합(0006)', () => {
  it('posts.kind는 필수이고 기본값은 일반 글(general)', () => {
    expect(column(posts, 'kind')).toMatchObject({ notNull: true, default: 'general', length: 20 });
  });

  it('활동형 칼럼(제목·종류·시즌·모임 날짜)은 nullable이고, 이관 멱등성 키는 unique', () => {
    for (const name of ['title', 'activity_type', 'season_id', 'activity_date']) {
      expect(column(posts, name).notNull, name).toBe(false);
    }
    expect(column(posts, 'source_key').isUnique).toBe(true);
  });

  it('종류별 필수 칼럼을 CHECK로 DB가 보장하고, 피드 필터용 (kind, created_at) 인덱스가 있다', () => {
    const config = getTableConfig(posts);
    expect(config.checks.map((c) => c.name)).toContain('posts_kind_fields');
    expect(config.indexes.map((i) => i.config.name)).toContain('posts_kind_created_at_idx');
  });
});

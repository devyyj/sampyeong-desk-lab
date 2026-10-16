// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from './schema';
import {
  users, boardGames, seasonMembers, seasons, documents,
  posts, postImages, comments, postLikes, commentLikes, boardGameLikes,
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
    expect(getTableConfig(seasonMembers).primaryKeys[0].columns.map((c) => c.name)).toEqual(['season_id', 'user_id']);
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

  it('comments는 게시글 하나를 가리키고(0009에서 post_id 필수), 작성자가 필수', () => {
    expect(column(comments, 'post_id').notNull).toBe(true);
    expect(column(comments, 'author_id').notNull).toBe(true);
  });

  it('좋아요 테이블은 (대상, 회원) 복합 PK로 회원당 1회만 허용', () => {
    expect(getTableConfig(postLikes).primaryKeys[0].columns.map((c) => c.name)).toEqual(['post_id', 'user_id']);
    expect(getTableConfig(commentLikes).primaryKeys[0].columns.map((c) => c.name)).toEqual(['comment_id', 'user_id']);
  });
});

describe('schema: 보드게임 좋아요(0011)', () => {
  it('board_game_likes는 (게임, 회원) 복합 PK로 회원당 1회만 허용하고, 게임·회원이 지워지면 함께 지운다', () => {
    const config = getTableConfig(boardGameLikes);
    expect(config.primaryKeys[0].columns.map((c) => c.name)).toEqual(['board_game_id', 'user_id']);
    expect(config.foreignKeys.map((fk) => fk.onDelete)).toEqual(['cascade', 'cascade']);
  });
});

describe('schema: 피드·활동 통합(0006)', () => {
  it('시즌·모임 날짜는 nullable(선택 입력)이고, 이관 멱등성 키는 unique', () => {
    for (const name of ['season_id', 'activity_date']) {
      expect(column(posts, name).notNull, name).toBe(false);
    }
    expect(column(posts, 'source_key').isUnique).toBe(true);
  });
});

describe('schema: 양식 통합(0008)', () => {
  it('posts.tags는 필수 text 배열(기본 빈 배열)이고, 5개 이하를 CHECK로 보장하며 태그 조회용 인덱스가 있다', () => {
    expect(column(posts, 'tags')).toMatchObject({ notNull: true, columnType: 'PgArray' });
    const config = getTableConfig(posts);
    expect(config.checks.map((c) => c.name)).toContain('posts_tags_max');
    expect(config.indexes.map((i) => i.config.name)).toContain('posts_tags_idx');
  });

  it('글 종류 구분(posts_kind_fields CHECK·kind 인덱스)은 없앴다: 모든 글이 날짜·시즌·태그를 선택으로 가진다', () => {
    const config = getTableConfig(posts);
    expect(config.checks.map((c) => c.name)).not.toContain('posts_kind_fields');
    expect(config.indexes.map((i) => i.config.name)).not.toContain('posts_kind_created_at_idx');
  });
});

describe('schema: 옛 활동 구조 정리(0009)', () => {
  it('posts에서 예전 글 종류·제목·활동 종류 칼럼을 지웠다', () => {
    const names = getTableConfig(posts).columns.map((c) => c.name);
    for (const name of ['kind', 'title', 'activity_type']) expect(names, name).not.toContain(name);
  });

  it('옛 활동 테이블(activities·activity_photos·activity_likes)은 schema에 없다', () => {
    for (const name of ['activities', 'activityPhotos', 'activityLikes']) expect(schema, name).not.toHaveProperty(name);
  });

  it('comments에서 activity_id와 대상 하나 CHECK·활동 인덱스를 지웠다', () => {
    const config = getTableConfig(comments);
    expect(config.columns.map((c) => c.name)).not.toContain('activity_id');
    expect(config.checks.map((c) => c.name)).not.toContain('comments_one_target');
    expect(config.indexes.map((i) => i.config.name)).not.toContain('comments_activity_id_created_at_idx');
  });
});

describe('schema: 옛 단일 사진 칼럼 정리(0010)', () => {
  it('posts.image_url은 지웠다(0005에서 post_images로 옮긴 뒤 아무도 읽지 않음)', () => {
    expect(getTableConfig(posts).columns.map((c) => c.name)).not.toContain('image_url');
  });
});

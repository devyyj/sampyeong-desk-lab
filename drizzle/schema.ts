import { pgTable, text, varchar, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  username: varchar('username', { length: 50 }).notNull().unique(), // 아이디
  pinHash: text('pin_hash').notNull(), // 4자리 비밀번호 (해시)
  department: varchar('department', { length: 100 }).notNull(), // 소속 부서(팀)
  profileImageUrl: text('profile_image_url'), // 프로필 사진 URL
  bio: varchar('bio', { length: 255 }), // 한 줄 자기소개
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  imageUrl: text('image_url'), // 게시글 이미지 URL
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const boardGames = pgTable('board_games', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).notNull(),
  recommendedPlayers: varchar('recommended_players', { length: 50 }), // 추천 인원수 (예: "2~4명")
  playTime: varchar('play_time', { length: 50 }), // 플레이 시간 (예: "30~60분")
  thumbnailUrl: text('thumbnail_url'), // 보드게임 썸네일 이미지 URL
  status: varchar('status', { length: 20 }).default('AVAILABLE').notNull(), // AVAILABLE, PLAYING, BORROWED
  addedById: uuid('added_by_id').references(() => users.id, { onDelete: 'set null' }), // 등록자
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  boardGames: many(boardGames),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

export const boardGamesRelations = relations(boardGames, ({ one }) => ({
  addedBy: one(users, {
    fields: [boardGames.addedById],
    references: [users.id],
  }),
}));

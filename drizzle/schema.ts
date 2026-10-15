import { pgTable, text, varchar, timestamp, uuid, integer, boolean, date, primaryKey, unique } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  username: varchar('username', { length: 50 }).notNull().unique(), // 아이디 (Confluence 이관 회원은 사내 ID)
  // 4자리 비밀번호 (해시).
  // NULL = Confluence에서 이관된 "사전 등록(미가입)" 계정. 같은 아이디로 가입하면 이 행에 PIN을 채워 연결(claim)한다.
  pinHash: text('pin_hash'),
  displayName: varchar('display_name', { length: 50 }), // 실명 (Confluence "이름/부서" 표기에서 추출)
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
  category: varchar('category', { length: 50 }), // 카테고리 (예: "전략", "추리")
  recommendedPlayers: varchar('recommended_players', { length: 50 }), // 추천 인원수 (예: "2~4명")
  playTime: varchar('play_time', { length: 50 }), // 플레이 시간 (예: "30~60분")
  thumbnailUrl: text('thumbnail_url'), // 보드게임 썸네일 이미지 URL
  status: varchar('status', { length: 20 }).default('AVAILABLE').notNull(), // AVAILABLE, PLAYING, BORROWED
  // 보유자(게임 주인). 앱에서 게임을 "등록한 사람"(addedById)과는 다른 개념이라 별도 컬럼으로 둔다.
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  note: text('note'), // 비고 (예: "머더 미스터리")
  inSharedCabinet: boolean('in_shared_cabinet').default(false).notNull(), // 공용 보관함 보관 여부
  // Confluence import 멱등성 키("<정규화 이름>:<보유자 ID>"). 앱에서 만든 게임은 NULL.
  sourceKey: text('source_key').unique(),
  addedById: uuid('added_by_id').references(() => users.id, { onDelete: 'set null' }), // 등록자
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 시즌(분기 단위 활동 기간). id는 serial이 아닌 시즌 번호 그대로(1, 2, ...)를 쓴다.
export const seasons = pgTable('seasons', {
  id: integer('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(), // "시즌 1"
  period: varchar('period', { length: 50 }).notNull(), // "25년 4분기"
});

export const seasonMembers = pgTable('season_members', {
  seasonId: integer('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }), // "회장" 등 직책
  note: text('note'), // 명부 비고 원문 (🎖️/💎 뱃지 등)
}, (t) => [primaryKey({ columns: [t.seasonId, t.userId] })]);

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  seasonId: integer('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // ESCAPE_ROOM | REGULAR | LUNCH | EVENING | OTHER
  title: text('title').notNull(),
  bodyMd: text('body_md').notNull(), // 활동 내용 (Markdown)
  noteMd: text('note_md'), // 비고/후기 (Markdown, 사진 제외)
  // Confluence import 멱등성 키("<pageId>:<행 번호>")
  sourceKey: text('source_key').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const activityPhotos = pgTable('activity_photos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  // private 버킷(activity_photos) 내 경로. URL은 조회 시 signed URL로 발급하므로 저장하지 않는다.
  storagePath: text('storage_path').notNull(),
  position: integer('position').notNull(), // 활동 내 사진 순서 (0부터)
}, (t) => [unique().on(t.activityId, t.position)]);

// 회칙, 공용 보관함 안내 같은 서술형 문서
export const documents = pgTable('documents', {
  slug: varchar('slug', { length: 50 }).primaryKey(), // "rules", "shared-cabinet"
  title: text('title').notNull(),
  bodyMd: text('body_md').notNull(),
  sourcePageId: varchar('source_page_id', { length: 20 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  boardGames: many(boardGames, { relationName: 'addedBy' }),
  ownedBoardGames: many(boardGames, { relationName: 'owner' }),
  seasonMemberships: many(seasonMembers),
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
    relationName: 'addedBy',
  }),
  owner: one(users, {
    fields: [boardGames.ownerId],
    references: [users.id],
    relationName: 'owner',
  }),
}));

export const seasonsRelations = relations(seasons, ({ many }) => ({
  members: many(seasonMembers),
  activities: many(activities),
}));

export const seasonMembersRelations = relations(seasonMembers, ({ one }) => ({
  season: one(seasons, { fields: [seasonMembers.seasonId], references: [seasons.id] }),
  user: one(users, { fields: [seasonMembers.userId], references: [users.id] }),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  season: one(seasons, { fields: [activities.seasonId], references: [seasons.id] }),
  photos: many(activityPhotos),
}));

export const activityPhotosRelations = relations(activityPhotos, ({ one }) => ({
  activity: one(activities, { fields: [activityPhotos.activityId], references: [activities.id] }),
}));

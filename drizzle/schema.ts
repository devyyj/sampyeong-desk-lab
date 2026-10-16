import { pgTable, text, varchar, timestamp, uuid, integer, boolean, date, primaryKey, unique, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  username: varchar('username', { length: 50 }).notNull().unique(), // 아이디 (Confluence 이관 회원은 사내 ID). 로그인에만 쓴다
  // 화면에 보이는 이름(게시글·댓글 작성자). 최초값은 아이디이고 마이페이지에서 바꾼다.
  // 대소문자만 다른 닉네임도 같은 사람으로 보이므로 lower(nickname) 고유 인덱스로 중복을 막는다(0005).
  nickname: varchar('nickname', { length: 20 }).notNull(),
  // 4자리 비밀번호 (해시).
  // NULL = Confluence에서 이관된 "사전 등록(미가입)" 계정. 같은 아이디로 가입하면 이 행에 PIN을 채워 연결(claim)한다.
  pinHash: text('pin_hash'),
  displayName: varchar('display_name', { length: 50 }), // 실명 (Confluence "이름/부서" 표기에서 추출)
  department: varchar('department', { length: 100 }).notNull(), // 소속 부서(팀)
  profileImageUrl: text('profile_image_url'), // 프로필 사진 URL
  bio: varchar('bio', { length: 255 }), // 한 줄 자기소개
  // 관리자 여부. 회원 생성·PIN 초기화 권한은 세션 값이 아닌 이 컬럼으로 매번 판단한다.
  isAdmin: boolean('is_admin').default(false).notNull(),
  // 관리자가 발급/초기화한 PIN을 쓰는 중이면 true. 로그인 후 PIN을 바꾸기 전까지 다른 페이지 이용을 막는다.
  mustChangePin: boolean('must_change_pin').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('users_nickname_lower_unique').on(sql`lower(${t.nickname})`)]);

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  // 사진은 post_images 테이블에 여러 장으로 둔다. 예전 단일 사진 URL 칼럼(image_url)은 0005에서 옮긴 뒤 0010에서 지웠다.
  // 시즌·모임 날짜는 모든 글의 선택 입력이다(입력한 경우에만 카드에 보인다).
  // 예전 글 종류(kind)·활동 제목(title)·활동 종류(activity_type)는 0008에서 태그·본문 첫 줄로 옮긴 뒤 0009에서 지웠다.
  seasonId: integer('season_id').references(() => seasons.id),
  activityDate: date('activity_date', { mode: 'string' }),
  // 활동 이관 멱등성 키(예전 activities.source_key, Confluence "<pageId>:<행 번호>")
  sourceKey: text('source_key').unique(),
  // 태그(0008). 예전 "활동 종류"를 대신한다. 앞의 #는 빼고 저장하고 최대 5개(src/lib/tags.ts, posts_tags_max CHECK).
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  check('posts_tags_max', sql`cardinality(${t.tags}) <= 5`),
  // 태그 모아 보기(tags @> ARRAY['방탈출'])용 GIN 인덱스.
  index('posts_tags_idx').using('gin', t.tags),
]);

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

// 회칙, 공용 보관함 안내 같은 서술형 문서
export const documents = pgTable('documents', {
  slug: varchar('slug', { length: 50 }).primaryKey(), // "rules", "shared-cabinet"
  title: text('title').notNull(),
  bodyMd: text('body_md').notNull(),
  sourcePageId: varchar('source_page_id', { length: 20 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 게시글 사진(여러 장). 비공개 버킷(activity_photos, POST_PHOTOS_BUCKET) 안 경로만 저장하고 화면에서 서명 URL을 만든다.
export const postImages = pgTable('post_images', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(), // {userId}/{uuid}.{ext}
  position: integer('position').notNull(), // 0부터, 표시 순서
}, (t) => [unique().on(t.postId, t.position)]);

// 게시글 댓글. 예전에는 활동 기록 댓글(activity_id)도 같은 테이블에 두고 "둘 중 하나"를 CHECK로 보장했지만,
// 활동 기록이 게시글로 합쳐져(0006 이관) 0009에서 activity_id를 지우고 post_id를 필수로 바꿨다.
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('comments_post_id_created_at_idx').on(t.postId, t.createdAt),
]);

// 좋아요는 대상별 테이블로 둔다. 진짜 FK + cascade를 걸 수 있고, 복합 PK가 "회원당 1회"를 보장한다.
export const postLikes = pgTable('post_likes', {
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.postId, t.userId] })]);

export const commentLikes = pgTable('comment_likes', {
  commentId: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.commentId, t.userId] })]);

// 보드게임 좋아요(0011). 게시글·댓글 좋아요와 같은 구조로, 보드게임 목록을 좋아요 많은 순으로 정렬하는 데 쓴다.
export const boardGameLikes = pgTable('board_game_likes', {
  boardGameId: uuid('board_game_id').notNull().references(() => boardGames.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.boardGameId, t.userId] })]);

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  boardGames: many(boardGames, { relationName: 'addedBy' }),
  ownedBoardGames: many(boardGames, { relationName: 'owner' }),
  seasonMemberships: many(seasonMembers),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  images: many(postImages),
  comments: many(comments),
  likes: many(postLikes),
  season: one(seasons, { fields: [posts.seasonId], references: [seasons.id] }),
}));

export const postImagesRelations = relations(postImages, ({ one }) => ({
  post: one(posts, { fields: [postImages.postId], references: [posts.id] }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
  likes: many(commentLikes),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(posts, { fields: [postLikes.postId], references: [posts.id] }),
}));

export const commentLikesRelations = relations(commentLikes, ({ one }) => ({
  comment: one(comments, { fields: [commentLikes.commentId], references: [comments.id] }),
}));

export const boardGameLikesRelations = relations(boardGameLikes, ({ one }) => ({
  boardGame: one(boardGames, { fields: [boardGameLikes.boardGameId], references: [boardGames.id] }),
}));

export const boardGamesRelations = relations(boardGames, ({ one, many }) => ({
  likes: many(boardGameLikes),
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
}));

export const seasonMembersRelations = relations(seasonMembers, ({ one }) => ({
  season: one(seasons, { fields: [seasonMembers.seasonId], references: [seasons.id] }),
  user: one(users, { fields: [seasonMembers.userId], references: [users.id] }),
}));

-- 커뮤니티 기능: 닉네임, 게시글 사진 여러 장, 댓글, 좋아요
-- 설계: docs/superpowers/specs/2026-10-16-community-features-design.md §3
-- 손으로 작성한 마이그레이션이다(drizzle/schema.ts와 같은 구조). 공유 운영 DB에 적용되므로 사용자 확인 후 적용한다.

-- 1) 닉네임 -----------------------------------------------------------------------------------------
-- 최초값은 아이디. 아이디가 20자를 넘거나 대소문자만 다른 아이디가 있으면 아래에서 실패한다(적용 전 조회로 확인).
ALTER TABLE "users" ADD COLUMN "nickname" varchar(20);
UPDATE "users" SET "nickname" = left("username", 20);
ALTER TABLE "users" ALTER COLUMN "nickname" SET NOT NULL;
-- 대소문자만 다른 닉네임도 같은 사람으로 보이므로 lower()로 중복을 막는다. 앱의 사전 조회와 달리 동시 변경 경쟁까지 막는다.
CREATE UNIQUE INDEX "users_nickname_lower_unique" ON "users" (lower("nickname"));

-- 2) 게시글 사진 -------------------------------------------------------------------------------------
CREATE TABLE "post_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "storage_path" text NOT NULL,
  "position" integer NOT NULL,
  CONSTRAINT "post_images_post_id_position_unique" UNIQUE ("post_id", "position")
);
-- 예전 단일 사진(공개 URL)을 버킷 안 경로로 바꿔 첫 번째 사진으로 옮긴다. posts.image_url 컬럼은 되돌릴 수 있게 남겨 둔다.
INSERT INTO "post_images" ("post_id", "storage_path", "position")
SELECT "id", substring("image_url" from '/object/public/post_images/(.+)$'), 0
FROM "posts"
WHERE "image_url" IS NOT NULL
  AND substring("image_url" from '/object/public/post_images/(.+)$') IS NOT NULL;

-- 3) 댓글·좋아요 -------------------------------------------------------------------------------------
CREATE TABLE "comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid REFERENCES "posts"("id") ON DELETE CASCADE,
  "activity_id" uuid REFERENCES "activities"("id") ON DELETE CASCADE,
  "author_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  -- 게시글 또는 활동 중 정확히 하나에만 달린다.
  CONSTRAINT "comments_one_target" CHECK (num_nonnulls("post_id", "activity_id") = 1)
);
CREATE INDEX "comments_post_id_created_at_idx" ON "comments" ("post_id", "created_at");
CREATE INDEX "comments_activity_id_created_at_idx" ON "comments" ("activity_id", "created_at");

-- 복합 PK가 "회원당 1회"를 보장한다.
CREATE TABLE "post_likes" (
  "post_id" uuid NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "post_likes_post_id_user_id_pk" PRIMARY KEY ("post_id", "user_id")
);
CREATE TABLE "activity_likes" (
  "activity_id" uuid NOT NULL REFERENCES "activities"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "activity_likes_activity_id_user_id_pk" PRIMARY KEY ("activity_id", "user_id")
);
CREATE TABLE "comment_likes" (
  "comment_id" uuid NOT NULL REFERENCES "comments"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "comment_likes_comment_id_user_id_pk" PRIMARY KEY ("comment_id", "user_id")
);

-- 4) RLS·Storage 정책 --------------------------------------------------------------------------------
-- 앱은 Drizzle(postgres 직접 연결)로만 접근하므로 정책 없이 RLS만 켜서 publishable 키의 REST 경로를 막는다(0002·0003과 같은 방침).
ALTER TABLE "post_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "post_likes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_likes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comment_likes" ENABLE ROW LEVEL SECURITY;

-- 마이그레이션 기록 없이 운영 DB에 있던 익명 업로드 정책. 브라우저에 공개된 publishable 키만으로 누구나
-- 공개 버킷에 파일을 올릴 수 있게 했다. 삭제 후 업로드는 서비스 키(서명 업로드 URL 발급 포함)로만 가능하다.
DROP POLICY IF EXISTS "Allow anonymous inserts avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous inserts post_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous inserts boardgame_thumbnails" ON storage.objects;

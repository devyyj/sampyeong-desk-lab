-- 게시글 양식 통합: 글 종류(일반 글/활동 기록)를 없애고, 활동 종류는 태그로, 제목은 본문 첫 줄로 옮긴다.
-- 설계: docs/superpowers/specs/2026-10-17-unified-post-form-design.md §3.1
-- 손으로 작성한 마이그레이션이다(drizzle/schema.ts와 같은 구조). 공유 운영 DB에 적용되므로 사용자 확인 후, 백업을 받은 뒤 한 트랜잭션으로 적용한다.
-- kind·title·activity_type 칼럼은 되돌릴 여지를 두려고 남기고 0009에서 지운다(앱은 0008 이후 읽지 않는다).

-- 1) 태그 칼럼: 앞의 #는 빼고 저장, 최대 5개(src/lib/tags.ts와 같은 규칙).
ALTER TABLE "posts" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "posts" ADD CONSTRAINT "posts_tags_max" CHECK (cardinality("tags") <= 5);
CREATE INDEX "posts_tags_idx" ON "posts" USING gin ("tags");

-- 2) 기존 활동 기록: 종류 → 태그, 제목 → 본문 첫 줄. 태그가 빈 행만 바꿔 같은 행에 제목이 두 번 붙지 않게 한다.
UPDATE "posts"
SET "tags" = ARRAY["activity_type"],
    "content" = "title" || E'\n' || "content"
WHERE "kind" = 'activity' AND "activity_type" IS NOT NULL AND "title" IS NOT NULL AND "tags" = '{}'::text[];

-- 3) 종류별 필수 칼럼 CHECK와 kind 인덱스를 지운다: 이제 어떤 글이든 날짜·시즌·태그를 선택으로 가진다.
ALTER TABLE "posts" DROP CONSTRAINT "posts_kind_fields";
DROP INDEX "posts_kind_created_at_idx";

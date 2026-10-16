-- 피드·활동 기록 통합 1단계: posts에 "활동 기록" 종류와 활동 칼럼을 추가한다(추가만, 기존 데이터·앱에 영향 없음).
-- 설계: docs/superpowers/specs/2026-10-16-feed-activity-merge-design.md §3.1
-- 손으로 작성한 마이그레이션이다(drizzle/schema.ts와 같은 구조). 공유 운영 DB에 적용되므로 사용자 확인 후 적용한다.
-- 데이터 이관(activities → posts)은 scripts/merge-activities가 하고, 옛 테이블 삭제는 검증 후 0007에서 한다.

-- 기존 글은 모두 자유글이므로 DEFAULT로 채워진다.
ALTER TABLE "posts" ADD COLUMN "kind" varchar(20) DEFAULT 'general' NOT NULL;
ALTER TABLE "posts" ADD COLUMN "title" text;
ALTER TABLE "posts" ADD COLUMN "activity_type" varchar(20);
ALTER TABLE "posts" ADD COLUMN "season_id" integer REFERENCES "seasons"("id");
ALTER TABLE "posts" ADD COLUMN "activity_date" date;
ALTER TABLE "posts" ADD COLUMN "source_key" text;
ALTER TABLE "posts" ADD CONSTRAINT "posts_source_key_unique" UNIQUE ("source_key");

-- 종류별 필수 칼럼: 자유글은 활동 칼럼이 모두 비어 있고, 활동 기록은 모두 채워져 있어야 한다.
ALTER TABLE "posts" ADD CONSTRAINT "posts_kind_fields" CHECK (
  ("kind" = 'general' AND "title" IS NULL AND "activity_type" IS NULL AND "season_id" IS NULL AND "activity_date" IS NULL)
  OR ("kind" = 'activity' AND "title" IS NOT NULL AND "activity_type" IS NOT NULL AND "season_id" IS NOT NULL AND "activity_date" IS NOT NULL)
);

-- 피드 필터(전체 / 활동 기록 / 자유글) + 최신순 정렬용.
CREATE INDEX "posts_kind_created_at_idx" ON "posts" ("kind", "created_at");

-- RLS: posts는 이미 RLS가 켜져 있고 앱은 Drizzle 직접 연결이라 영향이 없다. 새 칼럼은 기존 정책을 그대로 따른다.

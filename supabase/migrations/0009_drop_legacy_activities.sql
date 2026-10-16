-- 옛 활동 구조 정리: 활동 기록이 게시글로 합쳐지고(0006 이관) 양식이 하나로 통합된 뒤(0008) 쓰지 않는 칼럼·테이블을 지운다.
-- 설계: docs/superpowers/specs/2026-10-17-unified-post-form-design.md (0009 정리)
-- 손으로 작성한 마이그레이션이다(drizzle/schema.ts와 같은 구조). 공유 운영 DB에 적용되므로 사용자 확인 후, 백업을 받은 뒤 한 트랜잭션으로 적용한다.
-- 순서 주의: 이 칼럼들을 아직 읽는 옛 앱 코드(0009 이전 schema.ts)가 배포돼 있으면 조회가 깨진다.
-- 반드시 새 schema.ts가 들어간 앱을 먼저 배포한 뒤 적용한다.

-- 0) 안전 장치: 지울 활동이 모두 게시글로 옮겨졌고, 게시글이 아닌 댓글이 없을 때만 진행한다(아니면 트랜잭션 전체 취소).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "activities" a WHERE NOT EXISTS (SELECT 1 FROM "posts" p WHERE p."id" = a."id" OR p."source_key" = a."source_key")) THEN
    RAISE EXCEPTION '게시글로 옮겨지지 않은 활동이 있습니다';
  END IF;
  IF EXISTS (SELECT 1 FROM "comments" WHERE "post_id" IS NULL) THEN
    RAISE EXCEPTION '게시글을 가리키지 않는 댓글이 있습니다';
  END IF;
END $$;

-- 1) 댓글: 대상은 게시글 하나뿐이다. "게시글 또는 활동 중 하나" CHECK와 활동 인덱스·칼럼(FK 포함)을 지우고 post_id를 필수로.
ALTER TABLE "comments" DROP CONSTRAINT "comments_one_target";
DROP INDEX "comments_activity_id_created_at_idx";
ALTER TABLE "comments" DROP COLUMN "activity_id";
ALTER TABLE "comments" ALTER COLUMN "post_id" SET NOT NULL;

-- 2) 옛 활동 테이블(자식 → 부모 순서). Storage 파일은 그대로 둔다: 같은 경로를 post_images가 가리키고 있다.
DROP TABLE "activity_likes";
DROP TABLE "activity_photos";
DROP TABLE "activities";

-- 3) 게시글의 옛 칼럼: 글 종류는 없어졌고, 활동 종류는 태그로, 제목은 본문 첫 줄로 옮겼다(0008).
ALTER TABLE "posts" DROP COLUMN "kind";
ALTER TABLE "posts" DROP COLUMN "title";
ALTER TABLE "posts" DROP COLUMN "activity_type";

-- 쓰지 않는 예전 게시글 사진 흔적 정리.
-- 1) posts.image_url: 0005 이전의 단일 사진 공개 URL. 0005에서 post_images 테이블로 옮긴 뒤 아무도 읽지 않는다.
-- 2) 공개 버킷 post_images: 양식 통합(0008) 이후 게시글 사진은 모두 비공개 버킷 activity_photos에 올라간다.
-- 손으로 작성한 마이그레이션이다(drizzle/schema.ts와 같은 구조). 공유 운영 DB에 적용되므로 사용자 확인 후, 백업을 받은 뒤 한 트랜잭션으로 적용한다.
-- 순서 주의: image_url을 조회하는 옛 앱(0010 이전 schema.ts)이 배포돼 있으면 조회가 깨지므로, 새 앱을 먼저 배포한 뒤 적용한다.
-- 버킷 자체는 Supabase가 storage 테이블 직접 삭제를 막으므로 SQL이 아니라 Storage API(deleteBucket)로 지운다(적용 스크립트).

-- 0) 안전 장치: 값이 남은 행이 있거나 버킷에 파일이 남아 있으면 트랜잭션 전체를 취소한다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "posts" WHERE "image_url" IS NOT NULL) THEN
    RAISE EXCEPTION 'image_url 값이 남은 게시글이 있습니다';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'post_images') THEN
    RAISE EXCEPTION 'post_images 버킷에 파일이 남아 있습니다';
  END IF;
END $$;

ALTER TABLE "posts" DROP COLUMN "image_url";

-- 0001에서 만든 공개 읽기 정책. 버킷을 지우면 쓸모없어지므로 함께 지운다.
DROP POLICY IF EXISTS "Public Access post_images" ON storage.objects;

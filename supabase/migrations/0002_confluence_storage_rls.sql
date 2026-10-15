-- Confluence import: 신규 테이블 RLS + Storage 버킷
--
-- 앱은 Drizzle(postgres 직접 연결)로 DB에 접근하므로 RLS의 영향을 받지 않는다.
-- RLS를 켜고 anon 정책을 두지 않는 목적은 Supabase REST(publishable key) 경로로의 노출 차단이다.
-- 특히 season_members(실명/부서)와 activities(활동 기록)는 회원 전용 데이터다.
ALTER TABLE "seasons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "season_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;

-- activity_photos: private 버킷.
-- 의도적으로 storage.objects 정책을 하나도 두지 않는다:
--   - 업로드는 import 스크립트가 service role로 수행 (RLS 우회)
--   - 조회는 앱 서버가 service role로 signed URL을 발급해 회원에게만 제공
-- document_images: 회칙/보관함 안내 이미지. 비회원도 보는 공개 문서라 public 버킷 + 공개 읽기만 허용.
INSERT INTO storage.buckets (id, name, public) VALUES
  ('activity_photos', 'activity_photos', false),
  ('document_images', 'document_images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access document_images" ON storage.objects FOR SELECT USING ( bucket_id = 'document_images' );

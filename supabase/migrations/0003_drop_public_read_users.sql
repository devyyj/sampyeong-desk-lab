-- users 테이블 공개 읽기 정책 제거
--
-- 0001_storage_rls.sql의 "Allow public read users"는 publishable(anon) 키로 users 전체 컬럼을 노출했다.
-- 여기에는 pin_hash가 포함되며, 4자리 PIN은 1만 가지뿐이라 bcrypt 해시여도 즉시 역산되어 계정 탈취가 가능하다.
-- Confluence import 이후에는 회원 실명/부서/사내 ID(회원 전용 정보)도 함께 노출된다.
-- 앱은 users를 Drizzle(postgres 직접 연결)로만 조회하므로 이 정책이 없어도 기능에 영향이 없다.
DROP POLICY IF EXISTS "Allow public read users" ON "users";

// Service Role Key는 RLS를 우회하는 관리자 키다. 이 파일이 클라이언트 번들에 섞이면 키가 브라우저로 새므로,
// server-only로 클라이언트 컴포넌트에서 import하는 순간 빌드가 실패하게 막는다.
// 앱 코드(src/)에서 Service Role(Secret) Key를 쓰는 곳은 이 파일 하나로 한정한다.
import 'server-only';
import { createClient } from '@supabase/supabase-js';

const ACTIVITY_PHOTOS_BUCKET = 'activity_photos';
// 페이지를 열어 둔 채 사진을 보는 시간을 넉넉히 잡되, 링크가 밖으로 공유돼도 오래 살아 있지 않도록 1시간.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function createAdminStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Vercel에는 Supabase 연동이 만든 SUPABASE_SECRET_KEY(sb_secret_ 형식)가 있고, 로컬 .env.local과 scripts/는
  // SUPABASE_SERVICE_ROLE_KEY 이름을 쓴다. 둘 다 RLS를 우회하는 같은 종류의 키라 연동 키를 우선 쓰고 없으면 기존 이름을 쓴다.
  // (같은 비밀값을 Vercel에 다른 이름으로 중복 등록하지 않기 위함)
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SECRET_KEY(또는 SUPABASE_SERVICE_ROLE_KEY) 환경 변수가 필요합니다.');
  }
  // 서버에서 한 번 쓰고 버리는 클라이언트라 세션 저장/갱신이 필요 없다.
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
}

/**
 * activity_photos(private 버킷)의 사진 경로들에 대해 signed URL을 발급한다.
 * 버킷에는 storage.objects 정책이 하나도 없어(0002_confluence_storage_rls.sql) anon 키로는 접근할 수 없고,
 * 회원 여부는 호출하는 페이지가 세션으로 확인한 뒤에 이 함수를 불러야 한다.
 *
 * 반환 배열은 입력 순서와 같다. 일부 파일만 실패해도 나머지 사진은 보여주기 위해 실패한 자리는 null로 둔다.
 */
export async function createSignedPhotoUrls(paths: string[]): Promise<(string | null)[]> {
  if (paths.length === 0) return [];
  const storage = createAdminStorage();
  const { data, error } = await storage.from(ACTIVITY_PHOTOS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error('activity photo signed URL error', error);
    return paths.map(() => null);
  }
  return data.map((item) => (item.error ? null : item.signedUrl));
}

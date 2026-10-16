// Service Role Key는 RLS를 우회하는 관리자 키다. 이 파일이 클라이언트 번들에 섞이면 키가 브라우저로 새므로,
// server-only로 클라이언트 컴포넌트에서 import하는 순간 빌드가 실패하게 막는다.
// 앱 코드(src/)에서 Service Role(Secret) Key를 쓰는 곳은 이 파일 하나로 한정한다.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { PostImageBucket } from './post-images';

const ACTIVITY_PHOTOS_BUCKET = 'activity_photos';
// 페이지를 열어 둔 채 사진을 보는 시간을 넉넉히 잡되, 링크가 밖으로 공유돼도 오래 살아 있지 않도록 1시간.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function createAdminStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // SUPABASE_SERVICE_ROLE_KEY(.env.local과 scripts/에서 쓰고, 이 Supabase 프로젝트에서 동작을 확인한 키)를 우선 쓴다.
  // Vercel의 Supabase 연동이 넣은 SUPABASE_SECRET_KEY는 Preview 배포에서 Storage가 'Invalid Compact JWS'(403)로
  // 거부했다(2026-10-16). 그래서 연동 키는 명시적인 키가 없을 때만 대체용으로 쓴다.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_SECRET_KEY) 환경 변수가 필요합니다.');
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

// 사용자 업로드용 공개 버킷. 0005에서 익명 업로드 정책을 지웠으므로 이 버킷들에 쓰는 일은 서비스 키로만 가능하다.
const AVATARS_BUCKET = 'avatars';
// 게시글 사진의 업로드·확인·삭제 흐름은 버킷만 다르고 같아서 아래 함수들이 버킷을 인자로 받는다(기본값은 예전 동작인 post_images).
// 어느 버킷인지는 게시글 종류로 정한다(post-images.ts bucketForKind).

/**
 * 프로필 사진을 서버에서 올리고 공개 URL을 돌려준다. 한 장이라 서명 URL 대신 서버 업로드를 유지한다.
 * body는 Buffer여야 한다: Server Action의 Web File을 SDK에 그대로 넘기면 Node에서 실패할 수 있다(AGENTS.md 7번).
 */
export async function uploadAvatar(path: string, body: Buffer, contentType: string): Promise<string> {
  const bucket = createAdminStorage().from(AVATARS_BUCKET);
  const { error } = await bucket.upload(path, body, { contentType });
  if (error) throw new Error(`avatar upload failed: ${error.message}`);
  return bucket.getPublicUrl(path).data.publicUrl;
}

/**
 * 게시글 사진을 브라우저가 Storage에 직접 올릴 수 있도록 경로별 서명 업로드 토큰을 발급한다.
 * 사진 여러 장(최대 10MB × 10)을 Server Action 본문으로 받지 않기 위한 방식이다(설계 §5).
 * upsert=false라 이미 있는 파일(다른 글의 사진)을 토큰으로 덮어쓸 수 없다. 경로는 호출하는 액션이
 * 로그인한 회원 폴더 안에서 새 uuid로 만든다.
 */
export async function createPostImageUploadUrls(
  paths: string[],
  bucketName: PostImageBucket = 'post_images',
): Promise<{ path: string; token: string }[]> {
  const bucket = createAdminStorage().from(bucketName);
  return Promise.all(
    paths.map(async (path) => {
      const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: false });
      if (error || !data) throw new Error(`signed upload URL failed: ${error?.message}`);
      return { path, token: data.token };
    }),
  );
}

/**
 * 게시글 저장 직전에 브라우저가 실제로 올린 파일의 크기·형식을 Storage에서 확인한다.
 * 서명 업로드 URL은 크기·형식을 강제하지 않으므로, 클라이언트 검사를 우회한 파일을 여기서 걸러낸다.
 * 없는 파일(업로드 실패, 지어낸 경로)은 null.
 */
export async function getPostImageInfo(
  paths: string[],
  bucketName: PostImageBucket = 'post_images',
): Promise<({ size?: number; contentType?: string } | null)[]> {
  const bucket = createAdminStorage().from(bucketName);
  return Promise.all(
    paths.map(async (path) => {
      const { data, error } = await bucket.info(path);
      if (error || !data) return null;
      return { size: data.size, contentType: data.contentType };
    }),
  );
}

/**
 * 게시글에서 뺀 사진·삭제된 게시글의 사진 파일을 지운다.
 * 실패해도 예외를 던지지 않는다: 파일이 남는 것보다 사용자의 글 수정·삭제가 실패하는 편이 더 나쁘다(설계 §4.3).
 */
export async function removePostImages(paths: string[], bucketName: PostImageBucket = 'post_images'): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await createAdminStorage().from(bucketName).remove(paths);
  if (error) console.error('post image cleanup failed', paths, error);
}

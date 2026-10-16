import './env';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * 브라우저에 공개된 publishable 키로 할 수 있는 일을 실제 Supabase에 직접 시도해 막혀 있는지 본다(AGENTS.md 6번).
 * 0005에서 익명 업로드 정책을 지웠으므로 공개 버킷 업로드는 서명 URL 없이는 거부돼야 하고,
 * 새 테이블은 RLS만 켜고 정책이 없으므로 REST로 읽어도 행이 나오지 않아야 한다.
 */
const publicClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};

test('publishable 키만으로는 공개 버킷에 파일을 올릴 수 없다', async () => {
  const supabase = publicClient();
  for (const bucket of ['post_images', 'avatars', 'boardgame_thumbnails']) {
    const path = `e2e_anon/${Date.now()}.txt`;
    const { data, error } = await supabase.storage.from(bucket).upload(path, new Blob(['x'], { type: 'text/plain' }));
    // 다른 이유(잘못된 키 등)로 실패한 것이 아니라 RLS가 막았는지까지 본다.
    expect(error?.message, bucket).toMatch(/row-level security/);
    expect(data, bucket).toBeNull();
  }
});

test('publishable 키로 새 테이블(댓글·좋아요·게시글 사진)을 읽어도 행이 나오지 않는다', async () => {
  const supabase = publicClient();
  for (const table of ['post_images', 'comments', 'post_likes', 'activity_likes', 'comment_likes']) {
    const { data } = await supabase.from(table).select('*').limit(1);
    // RLS가 켜져 있고 정책이 없으면 오류 없이 빈 배열이 온다(post_images에는 이관된 행이 1개 이상 있다).
    expect(data ?? [], table).toEqual([]);
  }
});

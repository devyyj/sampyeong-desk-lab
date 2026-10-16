// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createSignedPhotoUrls } from './storage-admin';

// server-only는 서버 번들 밖에서 import되면 throw하므로 테스트에서는 비운다.
vi.mock('server-only', () => ({}));

const createSignedUrls = vi.fn();
const from = vi.fn(() => ({ createSignedUrls }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ storage: { from } })),
}));

describe('createSignedPhotoUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('SUPABASE_SERVICE_ROLE_KEY가 있으면 연동 키(SUPABASE_SECRET_KEY)보다 우선 사용', async () => {
    // Vercel 연동이 넣은 SUPABASE_SECRET_KEY로는 Storage가 'Invalid Compact JWS'(403)를 반환한 적이 있다.
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_from_integration';
    createSignedUrls.mockResolvedValueOnce({ data: [{ path: 'a/1.jpg', signedUrl: 'https://signed/1', error: null }], error: null });
    await createSignedPhotoUrls(['a/1.jpg']);
    expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'service-role-key', expect.anything());
  });

  it('SUPABASE_SERVICE_ROLE_KEY가 없으면 SUPABASE_SECRET_KEY로 대체', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_from_integration';
    createSignedUrls.mockResolvedValueOnce({ data: [{ path: 'a/1.jpg', signedUrl: 'https://signed/1', error: null }], error: null });
    await createSignedPhotoUrls(['a/1.jpg']);
    expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'sb_secret_from_integration', expect.anything());
  });

  it('Service Role Key로 activity_photos 버킷에 1시간짜리 signed URL을 요청하고, 입력 순서대로 돌려준다', async () => {
    createSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'a/1.jpg', signedUrl: 'https://signed/1', error: null },
        { path: 'a/2.jpg', signedUrl: 'https://signed/2', error: null },
      ],
      error: null,
    });

    const urls = await createSignedPhotoUrls(['a/1.jpg', 'a/2.jpg']);

    expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'service-role-key', expect.anything());
    expect(from).toHaveBeenCalledWith('activity_photos');
    expect(createSignedUrls).toHaveBeenCalledWith(['a/1.jpg', 'a/2.jpg'], 3600);
    expect(urls).toEqual(['https://signed/1', 'https://signed/2']);
  });

  it('개별 파일 발급 실패는 null로 두어 나머지 사진은 보여준다', async () => {
    createSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'a/1.jpg', signedUrl: 'https://signed/1', error: null },
        { path: 'a/2.jpg', signedUrl: null, error: 'Object not found' },
      ],
      error: null,
    });
    expect(await createSignedPhotoUrls(['a/1.jpg', 'a/2.jpg'])).toEqual(['https://signed/1', null]);
  });

  it('요청 전체가 실패하면 모두 null', async () => {
    createSignedUrls.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await createSignedPhotoUrls(['a/1.jpg'])).toEqual([null]);
  });

  it('경로가 없으면 Storage를 호출하지 않는다', async () => {
    expect(await createSignedPhotoUrls([])).toEqual([]);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it('비밀키 환경 변수가 둘 다 없으면 두 이름을 모두 알려주는 오류', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(createSignedPhotoUrls(['a/1.jpg'])).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY.*SUPABASE_SECRET_KEY/);
  });
});

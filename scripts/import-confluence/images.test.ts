// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { optimizeImage, resolveLocalFile, documentImagePath, uploadImage, emptyBucket, type StorageLike } from './images';

describe('optimizeImage', () => {
  it('긴 변 1600으로 축소, webp, EXIF 제거', async () => {
    const src = await sharp({ create: { width: 4000, height: 2000, channels: 3, background: '#888' } })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'secret' } })
      .toBuffer();
    expect((await sharp(src).metadata()).exif).toBeDefined(); // 입력에는 EXIF가 있음을 전제로 확인

    const meta = await sharp(await optimizeImage(src)).metadata();
    expect([meta.format, meta.width, meta.height, meta.exif]).toEqual(['webp', 1600, 800, undefined]);
  });

  it('작은 이미지는 확대하지 않음', async () => {
    const src = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#888' } }).png().toBuffer();
    const meta = await sharp(await optimizeImage(src)).metadata();
    expect([meta.width, meta.height]).toEqual([800, 600]);
  });
});

describe('경로 헬퍼', () => {
  it('documentImagePath', () => {
    expect(documentImagePath('rules', 1)).toBe('rules/1.webp');
  });
  it('resolveLocalFile: 있으면 경로, 없으면 null', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'att-'));
    mkdirSync(path.join(dir, 'p1'));
    writeFileSync(path.join(dir, 'p1', 'a.png'), 'x');
    expect(resolveLocalFile(dir, 'p1', 'a.png')).toBe(path.join(dir, 'p1', 'a.png'));
    expect(resolveLocalFile(dir, 'p1', 'missing.png')).toBeNull();
  });
});

// supabase-js storage.from(bucket) 의 필요한 부분만 흉내 낸 가짜 버킷
function fakeStorage(tree: Record<string, { name: string; id: string | null }[]>, uploadError: unknown = null) {
  const bucket = {
    list: vi.fn(async (prefix: string) => ({ data: tree[prefix] ?? [], error: null })),
    remove: vi.fn(async (paths: string[]) => ({ data: paths, error: null })),
    upload: vi.fn(async () => ({ data: {}, error: uploadError })),
  };
  return { storage: { from: vi.fn(() => bucket) } as unknown as StorageLike, bucket };
}

describe('uploadImage', () => {
  it('webp contentType + upsert로 업로드', async () => {
    const { storage, bucket } = fakeStorage({});
    await uploadImage(storage, 'activity_photos', '1/x/0.webp', Buffer.from('a'));
    expect(bucket.upload).toHaveBeenCalledWith('1/x/0.webp', Buffer.from('a'), { contentType: 'image/webp', upsert: true });
  });
  it('error 응답이면 throw', async () => {
    const { storage } = fakeStorage({}, { message: 'denied' });
    await expect(uploadImage(storage, 'b', 'p', Buffer.from('a'))).rejects.toThrow('denied');
  });
});

describe('emptyBucket', () => {
  it('중첩 폴더를 순회해 모든 파일을 remove하고 개수 반환', async () => {
    const { storage, bucket } = fakeStorage({
      '': [{ name: '1', id: null }, { name: 'top.webp', id: 'f0' }],
      '1': [{ name: 'a', id: null }],
      '1/a': [{ name: '0.webp', id: 'f1' }, { name: '1.webp', id: 'f2' }],
    });
    expect(await emptyBucket(storage, 'activity_photos')).toBe(3);
    expect(bucket.remove.mock.calls.flatMap((c) => c[0]).sort()).toEqual(['1/a/0.webp', '1/a/1.webp', 'top.webp']);
  });
});

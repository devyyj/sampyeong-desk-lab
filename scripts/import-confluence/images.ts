import sharp from 'sharp';
import { existsSync } from 'fs';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';

/** supabase-js의 storage 중 이 스크립트가 쓰는 부분(테스트에서 가짜로 대체하기 쉽도록 좁힌 타입) */
export type StorageLike = Pick<SupabaseClient['storage'], 'from'>;

/**
 * 업로드 전 이미지 최적화.
 * - 원본 중 6MB가 넘는 사진이 있어, 긴 변 1600px(확대 안 함) + WebP 80으로 용량을 크게 줄인다.
 * - sharp는 기본적으로 메타데이터를 버리므로 휴대폰 사진의 GPS(EXIF)가 공개되지 않는다.
 * - 메타데이터를 버리면 EXIF 회전 정보도 사라지므로, 그 전에 rotate()로 실제 픽셀을 바로 세운다.
 */
export function optimizeImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/** 로컬 첨부 파일 경로. 없으면 null (본문이 참조하지만 다운로드되지 않은 파일은 건너뛰고 리포트한다) */
export function resolveLocalFile(attachmentsDir: string, pageId: string, fileName: string): string | null {
  const file = path.join(attachmentsDir, pageId, fileName);
  return existsSync(file) ? file : null;
}

/** Storage 키에 ":"를 쓰지 않으려고 sourceKey("<pageId>:<행>")의 ":"를 "_"로 바꾼다. */
export function activityPhotoPath(seasonId: number, sourceKey: string, position: number): string {
  return `${seasonId}/${sourceKey.replace(':', '_')}/${position}.webp`;
}

export function documentImagePath(slug: string, index: number): string {
  return `${slug}/${index}.webp`;
}

/** 같은 경로가 있으면 덮어쓴다(upsert) — import 재실행 시 중복 객체가 생기지 않게 */
export async function uploadImage(storage: StorageLike, bucket: string, filePath: string, data: Buffer): Promise<void> {
  const { error } = await storage.from(bucket).upload(filePath, data, { contentType: 'image/webp', upsert: true });
  if (error) throw new Error(`upload ${bucket}/${filePath} failed: ${error.message}`);
}

const LIST_LIMIT = 1000;

/** 버킷의 모든 객체 경로를 재귀적으로 모은다. Storage list는 폴더(id=null)를 한 단계씩만 보여준다. */
async function listAll(storage: StorageLike, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += LIST_LIMIT) {
    const { data, error } = await storage.from(bucket).list(prefix, { limit: LIST_LIMIT, offset });
    if (error) throw new Error(`list ${bucket}/${prefix} failed: ${error.message}`);
    for (const item of data ?? []) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...(await listAll(storage, bucket, full)));
      else files.push(full);
    }
    if ((data ?? []).length < LIST_LIMIT) break;
  }
  return files;
}

/** --reset 용: 버킷 안의 모든 객체를 지우고 지운 개수를 돌려준다. */
export async function emptyBucket(storage: StorageLike, bucket: string): Promise<number> {
  const files = await listAll(storage, bucket, '');
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await storage.from(bucket).remove(files.slice(i, i + 100));
    if (error) throw new Error(`remove from ${bucket} failed: ${error.message}`);
  }
  return files.length;
}

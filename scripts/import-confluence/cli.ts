import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { createClient } from '@supabase/supabase-js';
import * as schema from '../../drizzle/schema';
import type { ConfluencePage, Normalized, ParsedActivity } from './types';
import { normalize } from './normalize';
import { optimizeImage, resolveLocalFile, activityPhotoPath, documentImagePath, uploadImage, emptyBucket, type StorageLike } from './images';
import { loadAll, resetDatabase, type UploadedPaths } from './load';

const DATA_DIR = path.join(process.cwd(), 'data', 'confluence');
const ATTACHMENTS_DIR = path.join(DATA_DIR, 'attachments');
const BUCKETS_TO_RESET = ['avatars', 'post_images', 'boardgame_thumbnails', 'activity_photos', 'document_images'];

export type CliOptions = { dryRun: boolean; reset: boolean; yes: boolean };

export function parseArgs(argv: string[]): CliOptions {
  const known = new Set(['--dry-run', '--reset', '--yes']);
  const unknown = argv.filter((a) => !known.has(a));
  if (unknown.length) throw new Error(`알 수 없는 옵션: ${unknown.join(' ')}`);
  const opts = { dryRun: argv.includes('--dry-run'), reset: argv.includes('--reset'), yes: argv.includes('--yes') };
  // --reset은 users/posts까지 지우는 파괴적 작업이라 명시적 확인 플래그를 요구한다.
  if (opts.reset && !opts.yes) throw new Error('--reset requires --yes');
  return opts;
}

/**
 * 로컬에 없는 사진은 제외하고 목록을 돌려준다. 하나가 없다고 전체 import를 멈추지 않는다.
 * position은 다시 매기지 않는다: 원본 순서 번호를 유지해야 재실행 시 Storage 경로가 바뀌지 않는다.
 */
export function filterMissingPhotos(
  list: ParsedActivity[],
  resolve: (dir: string, pageId: string, fileName: string) => string | null = resolveLocalFile,
): { activities: ParsedActivity[]; missing: string[] } {
  const missing: string[] = [];
  const activities = list.map((a) => ({
    ...a,
    photos: a.photos.filter((p) => {
      if (resolve(ATTACHMENTS_DIR, p.pageId, p.fileName)) return true;
      missing.push(`${p.pageId}/${p.fileName}`);
      return false;
    }),
  }));
  return { activities, missing };
}

/** 동시 실행 수를 제한해 비동기 작업을 돌린다(Storage에 수백 건을 한꺼번에 보내지 않도록). */
async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < items.length) await worker(items[next++]);
  }));
}

async function uploadAll(storage: StorageLike, n: Normalized): Promise<{ uploaded: UploadedPaths; files: number; bytes: number }> {
  const uploaded: UploadedPaths = { activityPhotos: new Map(), documentImageUrls: new Map() };
  let files = 0;
  let bytes = 0;
  const put = async (bucket: string, filePath: string, pageId: string, fileName: string) => {
    const local = resolveLocalFile(ATTACHMENTS_DIR, pageId, fileName);
    if (!local) throw new Error(`첨부 파일 없음: ${pageId}/${fileName}`);
    const data = await optimizeImage(readFileSync(local));
    await uploadImage(storage, bucket, filePath, data);
    files++;
    bytes += data.length;
  };

  const photoJobs = n.activities.flatMap((a) => a.photos.map((p) => ({ a, p })));
  await runPool(photoJobs, 4, async ({ a, p }) => {
    const storagePath = activityPhotoPath(a.seasonId, a.sourceKey, p.position);
    await put('activity_photos', storagePath, p.pageId, p.fileName);
    const list = uploaded.activityPhotos.get(a.sourceKey) ?? [];
    list.push({ position: p.position, storagePath });
    uploaded.activityPhotos.set(a.sourceKey, list);
  });

  for (const d of n.documents) {
    const urls = new Map<string, string>();
    for (const [i, img] of d.images.entries()) {
      const filePath = documentImagePath(d.slug, i);
      await put('document_images', filePath, img.pageId, img.fileName);
      urls.set(img.fileName, storage.from('document_images').getPublicUrl(filePath).data.publicUrl);
    }
    uploaded.documentImageUrls.set(d.slug, urls);
  }
  return { uploaded, files, bytes };
}

function printReport(n: Normalized, pageCount: number) {
  const photos = n.activities.reduce((s, a) => s + a.photos.length, 0);
  console.log(`pages ${pageCount} / people ${n.people.length} / seasons ${n.seasons.length} / seasonMembers ${n.seasonMembers.length}` +
    ` / boardGames ${n.boardGames.length} / activities ${n.activities.length} / photos ${photos} / documents ${n.documents.length}`);
  for (const [key, list] of Object.entries(n.report)) console.log(`${key} (${list.length}): ${list.join(', ') || '-'}`);
}

export async function main(argv: string[]): Promise<void> {
  const opts = parseArgs(argv);
  const pages: ConfluencePage[] = JSON.parse(readFileSync(path.join(DATA_DIR, 'pages.json'), 'utf8'));

  const parsed = normalize(pages);
  const { activities, missing } = filterMissingPhotos(parsed.activities);
  const n: Normalized = { ...parsed, activities, report: { ...parsed.report, missingFiles: missing } };
  writeFileSync(path.join(DATA_DIR, 'normalized.json'), JSON.stringify(n, null, 2));

  if (opts.dryRun) {
    printReport(n, pages.length);
    return;
  }

  const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!DATABASE_URL || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요합니다.');
  }
  // 엉뚱한 DB에 쓰는 사고를 막기 위해 대상 호스트를 먼저 보여준다.
  console.log(`target DB host: ${new URL(DATABASE_URL).host}`);

  const client = postgres(DATABASE_URL, { prepare: false });
  const db = drizzle(client, { schema });
  // Service Role Key는 이 스크립트에서만 쓴다(RLS 우회 업로드). 앱 코드(src/)에서는 절대 사용하지 않는다.
  const storage = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage;

  try {
    if (opts.reset) {
      await resetDatabase(db);
      for (const bucket of BUCKETS_TO_RESET) console.log(`emptied ${bucket}: ${await emptyBucket(storage, bucket)} objects`);
    }
    const { uploaded, files, bytes } = await uploadAll(storage, n);
    console.log(`uploaded ${files} files (${(bytes / 1048576).toFixed(1)} MB)`);
    console.log('loaded', await loadAll(db, n, uploaded));
    printReport(n, pages.length);
  } finally {
    await client.end();
  }
}

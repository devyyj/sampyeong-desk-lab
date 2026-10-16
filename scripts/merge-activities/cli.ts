import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import postgres from 'postgres';
import { buildMergePlan, findPresident, type MergePlan, type MergeSource } from './plan';
import { renderReport } from './report';

/**
 * 활동 기록 → 게시글 이관 CLI.
 * 설계: docs/superpowers/specs/2026-10-16-feed-activity-merge-design.md §4
 *
 * - 기본은 dry-run: 읽기만 하고 변환 전·후 보고서를 data/merge-activities/<시각>/report.md에 쓴다.
 * - --apply: 원본을 backup.json으로 남긴 뒤 한 트랜잭션에서 옮기고, 건수 검증이 틀리면 전부 롤백한다.
 * - 옛 테이블(activities 등)은 지우지 않는다. 삭제는 앱 전환·검증 후 0007 마이그레이션에서 한다.
 *
 * Drizzle 스키마 대신 원시 SQL을 쓴다: 0007에서 activities 정의가 schema.ts에서 빠져도
 * 이 스크립트(되돌리기·재실행용)가 계속 같은 의미로 동작하게 하려는 것이다.
 */

const OUT_ROOT = path.join(process.cwd(), 'data', 'merge-activities');

export type CliOptions = { apply: boolean };

export function parseArgs(argv: string[]): CliOptions {
  const unknown = argv.filter((a) => a !== '--apply');
  // 오타(--aply 등)가 조용히 dry-run으로 넘어가면 "적용했다"고 착각할 수 있어 거부한다.
  if (unknown.length) throw new Error(`알 수 없는 옵션: ${unknown.join(' ')}`);
  return { apply: argv.includes('--apply') };
}

export type ActualCounts = MergePlan['summary'] & { leftoverActivityComments: number };

/**
 * 적용 직후(같은 트랜잭션 안에서) DB 건수가 계획과 같은지 확인한다. 틀리면 throw → 트랜잭션 롤백.
 * ON CONFLICT DO NOTHING으로 넣기 때문에, 충돌로 조용히 빠진 행이 있어도 여기서 드러난다.
 */
export function verifyCounts(expected: MergePlan['summary'], actual: ActualCounts): void {
  const labels: [keyof MergePlan['summary'], string][] = [
    ['posts', '게시글'],
    ['images', '사진'],
    ['likes', '좋아요'],
    ['comments', '댓글'],
  ];
  const diffs = labels
    .filter(([k]) => expected[k] !== actual[k])
    .map(([k, label]) => `${label}: 계획 ${expected[k]}, 실제 ${actual[k]}`);
  if (actual.leftoverActivityComments !== 0) diffs.push(`activity_id가 남은 댓글 ${actual.leftoverActivityComments}건`);
  if (diffs.length) throw new Error(`이관 검증 실패(롤백합니다) — ${diffs.join(' / ')}`);
}

type Sql = postgres.Sql | postgres.TransactionSql;

/** 이관 원본을 읽는다. activity_likes·activity_photos는 0007 전까지 남아 있다. */
async function readSource(sql: Sql) {
  const activities = await sql<MergeSource['activities']>`
    select id, season_id as "seasonId", date::text as date, type, title, body_md as "bodyMd",
           note_md as "noteMd", source_key as "sourceKey", created_at as "createdAt"
    from activities order by date, source_key`;
  const photos = await sql<MergeSource['photos']>`
    select activity_id as "activityId", storage_path as "storagePath", position from activity_photos`;
  const likes = await sql<MergeSource['likes']>`
    select activity_id as "activityId", user_id as "userId", created_at as "createdAt" from activity_likes`;
  const comments = await sql<{ id: string }[]>`select id from comments where activity_id is not null`;
  const members = await sql<{ seasonId: number; userId: string; role: string | null }[]>`
    select season_id as "seasonId", user_id as "userId", role from season_members`;
  const seasons = await sql<{ id: number; name: string }[]>`select id, name from seasons`;
  return {
    source: { activities: [...activities], photos: [...photos], likes: [...likes], activityCommentIds: comments.map((c) => c.id) },
    members: [...members],
    seasons: [...seasons],
  };
}

/** posts / post_images / post_likes에 넣고 댓글 대상을 바꾼다. 재실행해도 중복이 생기지 않게 모두 ON CONFLICT DO NOTHING. */
async function applyPlan(tx: postgres.TransactionSql, plan: MergePlan): Promise<void> {
  // postgres.js의 sql(rows)는 객체 키를 칼럼 이름으로 쓰므로 snake_case로 바꿔 넘긴다.
  const posts = plan.posts.map((p) => ({
    id: p.id,
    author_id: p.authorId,
    kind: p.kind,
    title: p.title,
    activity_type: p.activityType,
    season_id: p.seasonId,
    activity_date: p.activityDate,
    source_key: p.sourceKey,
    content: p.content,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }));
  if (posts.length) await tx`insert into posts ${tx(posts)} on conflict do nothing`;

  const images = plan.postImages.map((i) => ({ post_id: i.postId, storage_path: i.storagePath, position: i.position }));
  if (images.length) await tx`insert into post_images ${tx(images)} on conflict do nothing`;

  const likes = plan.postLikes.map((l) => ({ post_id: l.postId, user_id: l.userId, created_at: l.createdAt }));
  if (likes.length) await tx`insert into post_likes ${tx(likes)} on conflict do nothing`;

  // 게시글 id = 활동 id라 post_id에 activity_id를 그대로 옮기면 된다. 댓글 id가 그대로라 댓글 좋아요도 따라온다.
  // comments_one_target CHECK(둘 중 정확히 하나) 때문에 두 칼럼을 한 문장에서 같이 바꾼다.
  await tx`update comments set post_id = activity_id, activity_id = null where activity_id is not null`;
}

/** 적용 결과를 같은 트랜잭션 안에서 센다. 이관 대상(activity 원본 id)으로만 세서 앞으로 생길 다른 글과 섞이지 않게 한다. */
async function countActual(tx: postgres.TransactionSql, plan: MergePlan): Promise<ActualCounts> {
  const ids = plan.posts.map((p) => p.id);
  const [{ posts }] = await tx<{ posts: number }[]>`select count(*)::int as posts from posts where kind = 'activity' and id = any(${ids}::uuid[])`;
  const [{ images }] = await tx<{ images: number }[]>`select count(*)::int as images from post_images where post_id = any(${ids}::uuid[])`;
  const [{ likes }] = await tx<{ likes: number }[]>`select count(*)::int as likes from post_likes where post_id = any(${ids}::uuid[])`;
  const commentIds = plan.commentIds;
  const [{ comments }] = await tx<{ comments: number }[]>`
    select count(*)::int as comments from comments where id = any(${commentIds}::uuid[]) and post_id = any(${ids}::uuid[])`;
  const [{ left }] = await tx<{ left: number }[]>`select count(*)::int as left from comments where activity_id is not null`;
  return { posts, images, likes, comments, leftoverActivityComments: left };
}

export async function main(argv: string[]): Promise<void> {
  const opts = parseArgs(argv);
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) throw new Error('DATABASE_URL 환경 변수가 필요합니다.');
  // 엉뚱한 DB에 쓰는 사고를 막기 위해 대상 호스트를 먼저 보여준다.
  console.log(`target DB host: ${new URL(DATABASE_URL).host}`);
  console.log(opts.apply ? '모드: --apply (DB에 씁니다)' : '모드: dry-run (읽기만 합니다)');

  const generatedAt = new Date().toISOString();
  const outDir = path.join(OUT_ROOT, generatedAt.replace(/[:.]/g, '-'));
  mkdirSync(outDir, { recursive: true });

  const sql = postgres(DATABASE_URL, { prepare: false });
  try {
    const { source, members, seasons } = await readSource(sql);
    const presidentId = findPresident(members);
    const [president] = await sql<{ nickname: string; username: string }[]>`
      select nickname, username from users where id = ${presidentId}`;
    const plan = buildMergePlan(source, presidentId);

    const seasonName = new Map(seasons.map((s) => [s.id, s.name]));
    const photoCount = new Map<string, number>();
    for (const p of plan.postImages) photoCount.set(p.postId, (photoCount.get(p.postId) ?? 0) + 1);
    const report = renderReport({
      generatedAt,
      presidentName: `${president.nickname} (${president.username})`,
      summary: plan.summary,
      items: source.activities.map((a, i) => ({
        title: a.title,
        date: a.date,
        type: a.type,
        seasonName: seasonName.get(a.seasonId) ?? `시즌 ${a.seasonId}`,
        photos: photoCount.get(a.id) ?? 0,
        before: [a.bodyMd, a.noteMd && `\n[비고]\n${a.noteMd}`].filter(Boolean).join('\n'),
        after: plan.posts[i].content,
      })),
    });
    const reportPath = path.join(outDir, 'report.md');
    writeFileSync(reportPath, report);
    console.log(`보고서: ${reportPath}`);
    console.log('계획:', plan.summary);

    if (!opts.apply) return;

    // 되돌리기용 백업(설계 §4.1). 옛 테이블은 남겨 두지만, 0007 이후를 대비해 원본과 함께
    // 이관이 손대는 대상 테이블의 적용 전 상태도 통째로 파일로 남긴다(동호회 규모라 수백 행 수준).
    const backupPath = path.join(outDir, 'backup.json');
    const tables = ['activities', 'activity_photos', 'activity_likes', 'comments', 'comment_likes', 'posts', 'post_images', 'post_likes'];
    const dump: Record<string, unknown[]> = {};
    for (const t of tables) dump[t] = [...(await sql`select * from ${sql(t)}`)];
    writeFileSync(backupPath, JSON.stringify({ generatedAt, presidentId, source, tables: dump }, null, 2));
    console.log(`백업: ${backupPath}`);

    await sql.begin(async (tx) => {
      await applyPlan(tx, plan);
      const actual = await countActual(tx, plan);
      verifyCounts(plan.summary, actual);
      console.log('적용 완료:', actual);
    });
  } finally {
    await sql.end();
  }
}

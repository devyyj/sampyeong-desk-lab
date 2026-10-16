import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { activities } from '../../../../drizzle/schema';
import { getSession } from '@/lib/session';
import { createSignedPhotoUrls } from '@/lib/storage-admin';
import { getActivityType } from '@/lib/activity-types';
import Markdown from '@/components/Markdown';

export const dynamic = 'force-dynamic';

// activities.id는 uuid 컬럼이라 형식이 다른 값을 그대로 조회하면 Postgres가 캐스팅 오류(500)를 낸다.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 활동 상세. 본문·비고는 공개하고, 사진은 로그인한 회원에게만 signed URL로 보여준다.
 * 사진 버킷은 private이라 비회원에게는 URL 자체를 발급하지 않는다(HTML에 사진 주소가 남지 않음).
 */
export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const activity = await db.query.activities.findFirst({
    where: eq(activities.id, id),
    with: {
      season: true,
      photos: { orderBy: (photos, { asc }) => [asc(photos.position)] },
    },
  });
  if (!activity) notFound();

  const session = await getSession();
  const type = getActivityType(activity.type);
  const photoCount = activity.photos.length;
  // 비회원이면 Storage를 호출하지 않는다(불필요한 서명 발급과 URL 노출 방지).
  const photoUrls = session && photoCount > 0 ? await createSignedPhotoUrls(activity.photos.map((p) => p.storagePath)) : [];

  return (
    <article className="max-w-3xl mx-auto space-y-6">
      <Link href={`/activities?season=${activity.season.id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {activity.season.name} 활동 목록
      </Link>

      <header className="space-y-2 pb-4 border-b border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${type.badgeClass}`}>{type.label}</span>
          <time dateTime={activity.date} className="tabular-nums">{activity.date}</time>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{activity.title}</h1>
      </header>

      <Markdown>{activity.bodyMd}</Markdown>

      {activity.noteMd && (
        <section className="bg-muted/60 border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-2">비고</h2>
          <Markdown>{activity.noteMd}</Markdown>
        </section>
      )}

      {photoCount > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">사진 {photoCount}장</h2>
          {session ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photoUrls.map((url, i) =>
                url ? (
                  <a key={activity.photos[i].id} href={url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={url}
                      alt={`${activity.title} 사진 ${i + 1}`}
                      loading="lazy"
                      className="w-full aspect-square object-cover rounded-lg bg-muted"
                    />
                  </a>
                ) : (
                  <div
                    key={activity.photos[i].id}
                    className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground text-center p-2"
                  >
                    사진을 불러오지 못했습니다.
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">로그인하면 사진 {photoCount}장을 볼 수 있습니다.</p>
              <Link
                href={`/login?redirect=${encodeURIComponent(`/activities/${activity.id}`)}`}
                className="inline-block px-4 py-2 bg-foreground text-background rounded-full text-sm font-semibold hover:bg-foreground/90"
              >
                로그인
              </Link>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

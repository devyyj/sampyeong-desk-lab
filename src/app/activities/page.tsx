import Link from 'next/link';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { activities, seasons } from '../../../drizzle/schema';
import { resolveSeason } from '@/lib/seasons';
import { getActivityType } from '@/lib/activity-types';
import SeasonTabs from '@/components/SeasonTabs';

export const dynamic = 'force-dynamic';

/**
 * 활동 기록 목록. 비회원도 볼 수 있는 공개 페이지다(이관 스펙: 활동 사진만 회원 전용).
 * 목록에서는 사진 URL을 발급하지 않고 개수만 보여준다. signed URL 발급은 상세 페이지에서 회원에게만 한다.
 */
export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string | string[] }>;
}) {
  const { season: seasonParam } = await searchParams;
  const allSeasons = await db.query.seasons.findMany({ orderBy: [asc(seasons.id)] });
  const season = resolveSeason(seasonParam, allSeasons);

  if (!season) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader />
        <p className="text-center py-20 text-muted-foreground">등록된 시즌이 없습니다.</p>
      </div>
    );
  }

  const list = await db.query.activities.findMany({
    where: eq(activities.seasonId, season.id),
    orderBy: [desc(activities.date), desc(activities.createdAt)],
    columns: { id: true, date: true, type: true, title: true },
    // 사진은 개수만 필요하므로 id만 가져온다.
    with: { photos: { columns: { id: true } } },
  });

  // 시즌 요약: 종류별 활동 수(많은 순)
  const typeCounts = new Map<string, number>();
  for (const activity of list) {
    const { label } = getActivityType(activity.type);
    typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
  }
  const summary = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader />
      <SeasonTabs basePath="/activities" seasons={allSeasons} selectedId={season.id} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">
            {season.name} · {season.period}
          </h2>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">활동 {list.length}건</span>
            {summary.map(([label, count]) => (
              <span key={label}>{`${label} ${count}`}</span>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <p className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
            이 시즌에 기록된 활동이 없습니다.
          </p>
        ) : (
          <ul className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {list.map((activity) => {
              const type = getActivityType(activity.type);
              return (
                <li key={activity.id}>
                  <Link
                    href={`/activities/${activity.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                  >
                    <time dateTime={activity.date} className="shrink-0 w-24 text-sm tabular-nums text-muted-foreground">
                      {activity.date}
                    </time>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${type.badgeClass}`}>
                      {type.label}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-medium">{activity.title}</span>
                    {activity.photos.length > 0 && (
                      <span className="shrink-0 text-xs text-muted-foreground">📷 {activity.photos.length}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="pb-4 border-b border-border">
      <h1 className="text-2xl font-bold tracking-tight">활동 기록</h1>
      <p className="text-sm text-muted-foreground mt-1">시즌별 SDL 모임 기록입니다.</p>
    </div>
  );
}

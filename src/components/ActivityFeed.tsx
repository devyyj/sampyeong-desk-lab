'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { loadMoreActivities } from '@/app/actions/activities';
import { getActivityType } from '@/lib/activity-types';
import type { ActivityListItem, ActivityPage } from '@/lib/activity-list';

type SeasonInfo = { id: number; name: string; period: string; count: number };

/**
 * 활동 기록 목록(무한 스크롤). 시즌 선택 없이 모든 시즌을 최신 시즌부터 보여주고,
 * 바닥 근처에 닿으면 다음 페이지를 서버 액션으로 받아 이어 붙인다.
 *
 * 시즌 구분이 목록의 뼈대라서 시즌마다 큰 제목(이름·기간·전체 건수)을 두고, 스크롤하는 동안
 * 지금 어느 시즌을 보고 있는지 알 수 있도록 제목을 GNB(h-16) 바로 아래에 고정(sticky)한다.
 * 건수는 지금까지 불러온 줄 수가 아니라 시즌 전체 기준(서버가 센 값)이라 페이지를 더 불러와도 바뀌지 않는다.
 *
 * IntersectionObserver를 지원하지 않거나 자동 로드가 실패했을 때를 위해 "활동 더 보기" 버튼을 함께 둔다.
 * 실패하면 자동 로드를 멈춰(같은 오류로 요청이 반복되지 않게) 버튼으로만 다시 시도한다.
 */
export default function ActivityFeed({ seasons, initial }: { seasons: SeasonInfo[]; initial: ActivityPage }) {
  // offset은 서버에서 받은 줄 수 누적이다. 겹친 줄을 걸러내면 items 길이와 달라지므로 따로 센다.
  const [list, setList] = useState({ items: initial.items, hasMore: initial.hasMore, offset: initial.items.length });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // state는 렌더 후에야 바뀌므로, 같은 프레임에 관찰 콜백이 두 번 와도 한 번만 요청하도록 ref로 막는다.
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !list.hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadMoreActivities(list.offset);
      setList((prev) => {
        // 스크롤 중 새 활동이 추가되면 offset이 한 칸 밀려 이미 받은 줄이 다시 올 수 있다.
        const seen = new Set(prev.items.map((a) => a.id));
        return {
          items: [...prev.items, ...page.items.filter((a) => !seen.has(a.id))],
          hasMore: page.hasMore,
          offset: prev.offset + page.items.length,
        };
      });
    } catch {
      setFailed(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [list.hasMore, list.offset]);

  // 페이지를 받을 때마다(loadMore가 바뀔 때마다) 관찰을 새로 건다. 새 observer는 처음 관찰할 때 현재 교차 상태를
  // 한 번 알려주므로, 받아 온 페이지가 짧아 바닥 표시가 여전히 화면 안에 있어도 다음 페이지를 이어서 부른다.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || failed || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      // 바닥에 완전히 닿기 전에 미리 불러와 스크롤이 끊기지 않게 한다.
      { rootMargin: '400px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, failed]);

  if (list.items.length === 0) {
    return (
      <p className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">기록된 활동이 없습니다.</p>
    );
  }

  const seasonById = new Map(seasons.map((s) => [s.id, s]));
  // 서버가 시즌 최신순으로 정렬해 주므로 연속한 같은 시즌끼리 묶으면 시즌별 묶음이 된다.
  const groups: { seasonId: number; items: ActivityListItem[] }[] = [];
  for (const activity of list.items) {
    const last = groups.at(-1);
    if (last?.seasonId === activity.seasonId) last.items.push(activity);
    else groups.push({ seasonId: activity.seasonId, items: [activity] });
  }

  return (
    <div className="space-y-8">
      {groups.map(({ seasonId, items }) => {
        const season = seasonById.get(seasonId);
        const headingId = `season-${seasonId}`;
        return (
          <section key={seasonId} aria-labelledby={headingId} className="space-y-3">
            <div className="sticky top-16 z-10 -mx-1 px-1 py-2 bg-background/95 backdrop-blur">
              <div className="flex items-center gap-3 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 dark:border-primary-600/40 dark:bg-primary-600/15">
                <span aria-hidden className="h-8 w-1.5 shrink-0 rounded-full bg-primary-600" />
                <h2 id={headingId} className="flex flex-wrap items-baseline gap-x-2 min-w-0">
                  <span className="text-xl font-extrabold tracking-tight text-primary-600">{season?.name ?? `시즌 ${seasonId}`}</span>
                  {season && <span className="text-sm font-medium text-muted-foreground">{season.period}</span>}
                </h2>
                {season && (
                  <span className="ml-auto shrink-0 rounded-full bg-primary-600 px-2.5 py-0.5 text-xs font-bold text-white">
                    {season.count}건
                  </span>
                )}
              </div>
            </div>

            <ul className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
              {items.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))}
            </ul>
          </section>
        );
      })}

      <div ref={sentinelRef} aria-hidden className="h-px" />
      <div className="flex flex-col items-center gap-2 pb-4 text-sm text-muted-foreground">
        {failed && (
          <p role="alert" className="text-red-500">
            활동을 더 불러오지 못했습니다.
          </p>
        )}
        {loading && <p role="status">불러오는 중…</p>}
        {list.hasMore && !loading && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="px-4 py-2 rounded-full border border-border text-foreground hover:bg-muted transition-colors"
          >
            활동 더 보기
          </button>
        )}
        {!list.hasMore && <p>모든 활동을 불러왔습니다.</p>}
      </div>
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivityListItem }) {
  const type = getActivityType(activity.type);
  return (
    <li>
      <Link href={`/activities/${activity.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors">
        <time dateTime={activity.date} className="shrink-0 w-24 text-sm tabular-nums text-muted-foreground">
          {activity.date}
        </time>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${type.badgeClass}`}>{type.label}</span>
        <span className="flex-1 min-w-0 truncate font-medium">{activity.title}</span>
        {/* 사진·좋아요·댓글 수. 0이면 생략해 줄을 가볍게 둔다. */}
        {activity.photoCount > 0 && <span className="shrink-0 text-xs text-muted-foreground">📷 {activity.photoCount}</span>}
        {activity.likeCount > 0 && <span className="shrink-0 text-xs text-muted-foreground">❤ {activity.likeCount}</span>}
        {activity.commentCount > 0 && <span className="shrink-0 text-xs text-muted-foreground">💬 {activity.commentCount}</span>}
      </Link>
    </li>
  );
}

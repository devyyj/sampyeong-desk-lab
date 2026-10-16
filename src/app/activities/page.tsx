import { db } from '@/db';
import ActivityFeed from '@/components/ActivityFeed';
import { getActivityPage, getActivityStats } from '@/lib/activity-list';
import TopBar from '@/components/TopBar';

export const dynamic = 'force-dynamic';

/**
 * 활동 기록 목록. 비회원도 볼 수 있는 공개 페이지다(이관 스펙: 활동 사진만 회원 전용).
 * 목록에서는 사진 URL을 발급하지 않고 개수만 보여준다. signed URL 발급은 상세 페이지에서 회원에게만 한다.
 *
 * 시즌 선택 없이 항상 모든 시즌을 최신 시즌부터 보여주고, 시즌 구분은 목록 안의 시즌 제목으로 드러낸다.
 * 첫 페이지만 서버에서 그리고 나머지는 ActivityFeed가 스크롤에 맞춰 이어 붙인다(무한 스크롤).
 * 예전 주소의 ?season= 은 무시한다(전체 목록 안에서 그 시즌을 찾을 수 있으므로 오류로 보내지 않음).
 */
export default async function ActivitiesPage() {
  // 시즌 제목에 쓸 이름·기간. 목록 순서는 활동 쪽 정렬이 정하므로 여기서는 정렬하지 않는다.
  const allSeasons = await db.query.seasons.findMany();

  if (allSeasons.length === 0) {
    return (
      <div>
        <TopBar title="활동 기록" />
        <p className="text-center py-20 text-muted-foreground">등록된 시즌이 없습니다.</p>
      </div>
    );
  }

  const [firstPage, stats] = await Promise.all([getActivityPage(0), getActivityStats()]);

  return (
    <div>
      <TopBar title="활동 기록" />
      {/* 전체·종류별 활동 수. 한 줄을 넘치면 가로로 밀어 본다(첫 화면 높이를 아끼려고 줄바꿈하지 않음). */}
      <div className="-mx-4 px-4 flex gap-1.5 overflow-x-auto no-scrollbar text-[13px] whitespace-nowrap">
        <span className="px-2.5 py-1 rounded-full bg-foreground text-background font-semibold">활동 {stats.total}건</span>
        {stats.byType.map(([label, count]) => (
          <span key={label} className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{`${label} ${count}`}</span>
        ))}
      </div>

      <ActivityFeed
        initial={firstPage}
        seasons={allSeasons.map((s) => ({ id: s.id, name: s.name, period: s.period, count: stats.bySeason[s.id] ?? 0 }))}
      />
    </div>
  );
}

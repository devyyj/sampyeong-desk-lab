import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { activities } from '../../../../drizzle/schema';
import { getSession } from '@/lib/session';
import { createSignedPhotoUrls } from '@/lib/storage-admin';
import { getActivityType } from '@/lib/activity-types';
import Markdown from '@/components/Markdown';
import { isUuid } from '@/lib/uuid';
import { getComments, getLikeSummaries } from '@/lib/community';
import LikeButton from '@/components/LikeButton';
import CommentSection from '@/components/CommentSection';
import TopBar from '@/components/TopBar';
import PhotoCarousel from '@/components/PhotoCarousel';
import { primaryButtonClass } from '@/components/EmptyState';
import { CameraIcon } from '@/components/icons';
import { shortDate } from '@/lib/time';

export const dynamic = 'force-dynamic';

/**
 * 활동 상세. 본문·비고는 공개하고, 사진은 로그인한 회원에게만 signed URL로 보여준다.
 * 사진 버킷은 private이라 비회원에게는 URL 자체를 발급하지 않는다(HTML에 사진 주소가 남지 않음).
 */
export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

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
  const viewerId = session?.userId ?? null;
  const [photoUrls, likes, commentsById] = await Promise.all([
    session && photoCount > 0 ? createSignedPhotoUrls(activity.photos.map((p) => p.storagePath)) : Promise.resolve([]),
    getLikeSummaries('activity', [activity.id], viewerId),
    getComments('activity', [activity.id], viewerId),
  ]);
  const like = likes.get(activity.id) ?? { count: 0, liked: false };
  const comments = commentsById.get(activity.id) ?? [];

  const loginHref = `/login?redirect=${encodeURIComponent(`/activities/${activity.id}`)}`;
  // 서명 발급에 실패한 사진(null)은 캐러셀에서 빼고 몇 장인지만 알린다.
  const photos = photoUrls.flatMap((url, i) => (url ? [{ src: url, alt: `${activity.title} 사진 ${i + 1}` }] : []));
  const failedCount = photoUrls.length - photos.length;

  return (
    <article>
      {/* 활동 기록은 시즌 선택 없이 전체를 무한 스크롤로 보여주므로 시즌 쿼리 없이 돌아간다. */}
      <TopBar title="활동 기록" backHref="/activities" backLabel="활동 기록으로 돌아가기" />

      {/* 사진이 상세의 주인공이라 맨 위에 둔다. 회원: 화면 폭 캐러셀 / 비회원: 같은 자리에 로그인 안내. */}
      {photoCount > 0 && (
        <section aria-label={`사진 ${photoCount}장`} className="-mx-4 sm:mx-0">
          {session ? (
            <>
              {photos.length > 0 && (
                <div className="sm:rounded-xl sm:overflow-hidden">
                  <PhotoCarousel images={photos} aspect="1 / 1" />
                </div>
              )}
              {failedCount > 0 && (
                <p className="px-4 pt-2 text-xs text-muted-foreground">
                  <span>사진을 불러오지 못했습니다.</span> <span className="tabular-nums">{`(${failedCount}장)`}</span>
                </p>
              )}
            </>
          ) : (
            <div className="py-12 bg-muted flex flex-col items-center justify-center gap-3 px-6 text-center sm:rounded-xl">
              <CameraIcon size={32} className="text-muted-foreground" />
              <p className="text-[15px] text-muted-foreground">로그인하면 사진 {photoCount}장을 볼 수 있습니다.</p>
              <Link href={loginHref} className={primaryButtonClass}>
                로그인
              </Link>
            </div>
          )}
        </section>
      )}

      <header className="pt-4 pb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
          <span className="px-1.5 py-px rounded-md text-[11px] font-bold bg-primary-100 text-primary-600">{activity.season.name}</span>
          <span className={`px-1.5 py-px rounded-md text-[11px] font-bold ${type.badgeClass}`}>{type.label}</span>
          <time dateTime={activity.date} className="tabular-nums">
            {shortDate(activity.date)}
          </time>
        </div>
        <h1 className="text-[22px] font-bold leading-snug tracking-tight">{activity.title}</h1>
      </header>

      <Markdown>{activity.bodyMd}</Markdown>

      {activity.noteMd && (
        <section className="mt-5 rounded-2xl bg-muted/60 p-4">
          <h2 className="text-[13px] font-semibold text-muted-foreground mb-2">비고</h2>
          <Markdown>{activity.noteMd}</Markdown>
        </section>
      )}

      {/* 상세에서는 반응이 주인공이라 좋아요와 댓글을 항상 펼쳐 둔다(피드는 시트로 접어 둠). */}
      <section className="mt-6 pt-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2 -ml-2">
          <LikeButton target="activity" id={activity.id} liked={like.liked} count={like.count} canLike={session !== null} />
          <h2 className="text-[15px] font-bold">댓글 {comments.length}</h2>
        </div>
        <CommentSection
          target="activity"
          targetId={activity.id}
          comments={comments}
          // 관리자 여부는 삭제 버튼 표시용. 실제 권한은 deleteComment가 DB로 다시 확인한다.
          viewer={session ? { id: session.userId, isAdmin: session.isAdmin } : null}
          loginHref={loginHref}
        />
      </section>
    </article>
  );
}

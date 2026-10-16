'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FeedItem } from '@/lib/feed';
import { getActivityType } from '@/lib/activity-types';
import { shortDate } from '@/lib/time';
import Avatar from './Avatar';
import UserName from './UserName';
import PhotoCarousel from './PhotoCarousel';
import PostCaption from './PostCaption';
import PostMenu from './PostMenu';
import PostReactions from './PostReactions';
import LikeButton from './LikeButton';
import CommentSection from './CommentSection';
import { primaryButtonClass } from './EmptyState';
import { CameraIcon } from './icons';

type Props = {
  item: FeedItem;
  /** feed: 피드 카드(본문 3줄 접기, 댓글은 시트) / detail: 상세(본문 전체, 댓글 펼침) */
  variant?: 'feed' | 'detail';
  /** 비회원이 좋아요·댓글·잠긴 사진에서 누르는 로그인 링크(돌아올 주소 포함) */
  loginHref?: string;
  /** 보는 회원(좋아요·댓글 작성, 댓글 삭제 버튼 표시용). 실제 권한은 서버 액션이 다시 확인한다. */
  viewer?: { id: string; isAdmin: boolean } | null;
  /** 댓글이 바뀐 뒤 처리(목록이 이 글을 다시 받아 바꿔 끼운다). */
  onChanged?: () => void;
  /** 삭제가 끝난 뒤 처리(목록에서 빼기·피드로 이동). 없으면 PostMenu가 화면을 새로 그린다. */
  onDeleted?: () => void;
};

/**
 * 게시글 카드(자유글·활동 기록 공용). 설계 §5.2·§5.4.
 * 구성: 작성자 줄 → (활동) 종류·시즌·모임 날짜와 굵은 제목 → 사진(또는 잠긴 사진 안내) → 반응 → 본문 → 댓글.
 * 사진 없는 자유글은 본문이 주인공이라 본문을 반응 줄 위에 크게 둔다(예전 피드와 같은 배치).
 *
 * 무한 스크롤 목록(클라이언트)에서도 그려야 해서 클라이언트 컴포넌트다. 날짜·시간 문구는 서버가 만들어 넘긴다
 * (createdLabel). 모임 날짜(shortDate)는 시각이 없는 날짜라 서버·브라우저 시간대와 무관하게 같은 결과가 나온다.
 */
export default function PostCard({ item, variant = 'feed', loginHref = '/login?redirect=%2F', viewer = null, onChanged, onDeleted }: Props) {
  const detail = variant === 'detail';
  const router = useRouter();
  // 상세에서 지우면 그 글은 더 볼 수 없으니 피드로 돌아간다(새로 그리면 404가 된다).
  const afterDelete = onDeleted ?? (detail ? () => router.push('/') : undefined);
  const href = `/posts/${item.id}`;
  const hasImages = item.images.length > 0;
  const reactions = {
    postId: item.id,
    liked: item.liked,
    likeCount: item.likeCount,
    comments: item.comments,
    viewer,
    loginHref,
    onChanged,
  };

  const caption = detail ? (
    <p className="whitespace-pre-wrap break-words text-[16px] leading-relaxed">{item.content}</p>
  ) : (
    <PostCaption content={item.content} large={!hasImages && !item.activity && !item.photosLocked} />
  );

  return (
    <article className={detail ? '' : 'py-3 first:pt-0'}>
      <header className="flex items-center gap-2.5 h-11">
        <Avatar src={item.author.profileImageUrl} name={item.author.nickname} size={34} />
        <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
          <UserName userId={item.author.id} nickname={item.author.nickname} badge={item.badge} />
          <span className="text-muted-foreground text-sm" aria-hidden="true">·</span>
          <Link href={href} className="text-sm text-muted-foreground whitespace-nowrap hover:underline">
            <time dateTime={item.createdAt}>{item.createdLabel}</time>
          </Link>
        </div>
        {item.canEdit && <PostMenu postId={item.id} onDeleted={afterDelete} />}
      </header>

      {item.activity && <ActivityHead activity={item.activity} href={detail ? null : href} />}

      {(hasImages || item.photosLocked) && (
        // 모바일에서는 좌우 여백(main의 px-4)을 상쇄해 사진을 화면 끝까지 채운다.
        <div className="-mx-4 mt-1.5 sm:mx-0 sm:rounded-xl sm:overflow-hidden">
          {hasImages ? (
            <PhotoCarousel images={item.images} />
          ) : (
            // 활동 사진은 회원 전용이다. 비회원에게는 주소를 발급하지 않고 장수만 알린다(설계 §6).
            <div className="py-10 bg-muted flex flex-col items-center justify-center gap-3 px-6 text-center">
              <CameraIcon size={30} className="text-muted-foreground" />
              <p className="text-[15px] text-muted-foreground">{`로그인하면 사진 ${item.photoCount}장을 볼 수 있어요`}</p>
              <Link href={loginHref} className={primaryButtonClass}>
                로그인
              </Link>
            </div>
          )}
        </div>
      )}

      {detail ? (
        // 상세는 본문이 먼저, 반응·댓글은 아래에 펼쳐 둔다(피드처럼 시트로 접지 않음).
        <>
          <div className="mt-3">{caption}</div>
          <section className="mt-6 pt-3 border-t border-border space-y-2">
            <div className="flex items-center gap-2 -ml-2">
              <LikeButton target="post" id={item.id} liked={item.liked} count={item.likeCount} canLike={viewer !== null} />
              <h2 className="text-[15px] font-bold">{`댓글 ${item.comments.length}`}</h2>
            </div>
            <CommentSection target="post" targetId={item.id} comments={item.comments} viewer={viewer} loginHref={loginHref} />
          </section>
        </>
      ) : hasImages || item.activity || item.photosLocked ? (
        <div className="mt-1">
          <PostReactions {...reactions}>{caption}</PostReactions>
        </div>
      ) : (
        <>
          <div className="mt-1 mb-1">{caption}</div>
          <PostReactions {...reactions} />
        </>
      )}
    </article>
  );
}

/**
 * 활동 기록 머리: 종류 배지 · 시즌 · 모임 날짜, 그 아래 굵은 제목(피드에서는 상세 링크, 상세에서는 크게).
 * 페이지 h1은 TopBar가 가지므로 제목은 h2로 둔다.
 */
function ActivityHead({ activity, href }: { activity: NonNullable<FeedItem['activity']>; href: string | null }) {
  const type = getActivityType(activity.type);
  return (
    <div className="mt-1 mb-2 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
        <span className={`px-1.5 py-px rounded-md text-[11px] font-bold ${type.badgeClass}`}>{type.label}</span>
        <span className="px-1.5 py-px rounded-md text-[11px] font-bold bg-muted text-muted-foreground">{activity.seasonName}</span>
        <time dateTime={activity.date} className="tabular-nums">
          {shortDate(activity.date)}
        </time>
      </div>
      {href ? (
        <h2 className="text-[17px] font-bold leading-snug tracking-tight">
          <Link href={href} className="hover:underline">
            {activity.title}
          </Link>
        </h2>
      ) : (
        <h2 className="text-[22px] font-bold leading-snug tracking-tight">{activity.title}</h2>
      )}
    </div>
  );
}

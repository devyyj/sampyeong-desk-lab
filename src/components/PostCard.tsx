'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FeedItem } from '@/lib/feed';
import { feedFilterHref } from '@/lib/feed-filter';
import Avatar from './Avatar';
import UserName from './UserName';
import PhotoCarousel from './PhotoCarousel';
import PostCaption from './PostCaption';
import PhotoThumbs from './PhotoThumbs';
import PostMenu from './PostMenu';
import PostReactions from './PostReactions';
import LikeButton from './LikeButton';
import CommentSection from './CommentSection';
import { CalendarIcon, CameraIcon } from './icons';

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
 * 게시글 카드. 설계: 2026-10-17-unified-post-form-design.md §4.2
 * 글 종류 구분 없이 모두 같은 모양이고, 선택 정보(모임 날짜·시즌·태그)는 입력한 경우에만 보인다.
 *
 * 피드: 작성자 줄(날짜 하나) → 시즌 칩 → 본문(3줄 접기) → 태그 → 작은 사진 줄 → 반응(댓글은 시트).
 *   사진은 피드를 훑기 쉽도록 작게(3칸 썸네일) 보여주고, 크게 보기는 Lightbox·상세에 맡긴다.
 * 상세: 작성자 줄 → 시즌 칩 → 화면 폭 캐러셀 → 본문 전체 → 태그 → 좋아요·댓글 펼침.
 *
 * 날짜는 작성자 줄에 하나만 둔다(모임 날짜가 있으면 모임 날짜, 없으면 작성 시각 — feed.ts가 정한다).
 * 무한 스크롤 목록(클라이언트)에서도 그려야 해서 클라이언트 컴포넌트이고, 날짜 문구는 서버가 만들어 넘긴다
 * (브라우저에서 계산하면 서버 렌더와 어긋나 hydration 불일치가 난다).
 */
export default function PostCard({ item, variant = 'feed', loginHref = '/login?redirect=%2F', viewer = null, onChanged, onDeleted }: Props) {
  const detail = variant === 'detail';
  const router = useRouter();
  // 상세에서 지우면 그 글은 더 볼 수 없으니 피드로 돌아간다(새로 그리면 404가 된다).
  const afterDelete = onDeleted ?? (detail ? () => router.push('/') : undefined);
  const href = `/posts/${item.id}`;
  const hasImages = item.images.length > 0;

  return (
    // 피드에서는 글마다 테두리 카드로 감싼다. 예전에는 얇은 구분선 하나(위아래 12px)뿐이라, 글 사이 간격이 글 안 요소 간격과
    // 비슷해서 어디서 한 글이 끝나는지 알기 어려웠다. 반응 줄 버튼(h-10)에 자체 여백이 있어 아래 패딩은 위보다 작게 둔다.
    <article className={detail ? '' : 'rounded-2xl border border-border px-4 pt-2 pb-1.5'}>
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

      {item.seasonName && (
        // 바탕색 없이 글자만 둔다(회색 칩은 눌리는 버튼처럼 보이고 본문 위에서 무거워 보였다).
        <span className="inline-block mt-0.5 text-[12px] font-bold text-muted-foreground">{item.seasonName}</span>
      )}
      {item.meetingDate && <MeetingDate date={item.meetingDate} label={item.meetingDateLabel ?? item.meetingDate} />}

      {detail ? (
        <>
          {hasImages && (
            // 모바일에서는 좌우 여백(main의 px-4)을 상쇄해 사진을 화면 끝까지 채운다.
            <div className="-mx-4 mt-1.5 sm:mx-0 sm:rounded-xl sm:overflow-hidden">
              <PhotoCarousel images={item.images} />
            </div>
          )}
          {item.photosLocked && <LockedPhotos count={item.photoCount} loginHref={loginHref} />}
          <p className="mt-3 whitespace-pre-wrap break-words text-[16px] leading-relaxed">{item.content}</p>
          <TagLinks tags={item.tags} />
          {/* 상세는 반응·댓글을 아래에 펼쳐 둔다(피드처럼 시트로 접지 않음). */}
          <section className="mt-6 pt-3 border-t border-border space-y-2">
            <div className="flex items-center gap-2 -ml-2">
              <LikeButton target="post" id={item.id} liked={item.liked} count={item.likeCount} canLike={viewer !== null} />
              <h2 className="text-[15px] font-bold">{`댓글 ${item.comments.length}`}</h2>
            </div>
            <CommentSection target="post" targetId={item.id} comments={item.comments} viewer={viewer} loginHref={loginHref} />
          </section>
        </>
      ) : (
        <>
          <div className="mt-1">
            <PostCaption content={item.content} large={!hasImages && !item.photosLocked} />
          </div>
          <TagLinks tags={item.tags} />
          {hasImages && (
            <div className="mt-2">
              <PhotoThumbs images={item.images} />
            </div>
          )}
          {item.photosLocked && <LockedPhotos count={item.photoCount} loginHref={loginHref} />}
          <div className="mt-1">
            <PostReactions
              postId={item.id}
              liked={item.liked}
              likeCount={item.likeCount}
              comments={item.comments}
              viewer={viewer}
              loginHref={loginHref}
              onChanged={onChanged}
            />
          </div>
        </>
      )}
    </article>
  );
}

/**
 * 비회원에게 잠긴 사진 안내. 모든 글의 사진은 회원 전용이라 주소를 발급하지 않고 장수만 알린다.
 * 사진 줄과 같은 자리를 차지하도록 한 줄 높이로 작게 둔다.
 */
function LockedPhotos({ count, loginHref }: { count: number; loginHref: string }) {
  return (
    <div className="mt-2 h-14 px-4 rounded-lg bg-muted flex items-center gap-2.5 text-[14px] text-muted-foreground">
      <CameraIcon size={20} className="shrink-0" />
      <p className="flex-1 min-w-0">{`로그인하면 사진 ${count}장을 볼 수 있어요`}</p>
      <Link href={loginHref} className="shrink-0 font-semibold text-foreground underline underline-offset-2">
        로그인
      </Link>
    </div>
  );
}

/**
 * 모임 날짜를 고른 글은 본문 위에 모임 날짜를 분명하게 적는다.
 * 머리줄 날짜는 "3일 전" 같은 상대 표기라, 정확히 언제 모였는지는 여기서 연도·요일까지 보여준다.
 */
function MeetingDate({ date, label }: { date: string; label: string }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-[14px]">
      <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">모임 날짜</span>
      <time dateTime={date} className="font-semibold">{label}</time>
    </p>
  );
}

/** 태그 칩. 누르면 그 태그 글만 모아 본다(/?tag=). 태그가 없으면 아무것도 그리지 않는다. */
function TagLinks({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label="태그" className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag}>
          <Link
            href={feedFilterHref({ tag })}
            className="h-7 px-2.5 inline-flex items-center rounded-full bg-muted text-[13px] font-medium text-foreground hover:bg-border"
          >
            {`#${tag}`}
          </Link>
        </li>
      ))}
    </ul>
  );
}

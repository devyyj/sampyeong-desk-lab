import { and, asc, desc, eq, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { postImages, posts } from '../../drizzle/schema';
import type { MemberBadge } from './badge';
import { getComments, getLikeSummaries, type CommentView } from './community';
import { getMemberBadges } from './member-badges';
import { postImagePublicUrl } from './post-images';
import { createSignedPhotoUrls } from './storage-admin';
import type { FeedFilter } from './feed-filter';
import { relativeTime } from './time';

/*
 * 통합 피드(자유글 + 활동 기록) 데이터. 설계: docs/superpowers/specs/2026-10-16-feed-activity-merge-design.md §5.2
 * 첫 페이지는 서버 컴포넌트가, 다음 페이지는 서버 액션(loadMoreFeed)이, 상세는 getPostView가 같은 변환(toItems)을 거쳐
 * 세 경로의 카드 모양·권한 표시가 어긋나지 않게 한다.
 */

export type { FeedFilter, FeedKind } from './feed-filter';

/** 활동 사진은 장마다 signed URL을 발급해야 해서 한 번에 많이 그리지 않는다. */
export const FEED_PAGE_SIZE = 10;

export type Viewer = { id: string; isAdmin: boolean } | null;

/** 클라이언트 컴포넌트로 넘기는 카드 한 장. Date 대신 서버에서 만든 문자열만 싣는다(hydration 불일치 방지). */
export type FeedItem = {
  id: string;
  authorId: string;
  author: { id: string; nickname: string; profileImageUrl: string | null };
  badge: MemberBadge | null;
  content: string;
  createdAt: string; // ISO
  createdLabel: string; // "30분 전"
  /** 활동 기록이면 머리 정보, 자유글이면 null */
  activity: { title: string; type: string; seasonName: string; date: string } | null;
  images: { src: string; alt: string }[];
  photoCount: number;
  /** 비회원이라 활동 사진을 숨겼는지(사진 자리에 로그인 안내를 그린다) */
  photosLocked: boolean;
  likeCount: number;
  liked: boolean;
  comments: CommentView[];
  /** 수정·삭제 메뉴 표시용. 실제 권한은 서버 액션이 DB로 다시 확인한다. */
  canEdit: boolean;
};

export type FeedPage = { items: FeedItem[]; hasMore: boolean };

function whereOf(filter: FeedFilter): SQL | undefined {
  if (filter.kind === 'general') return eq(posts.kind, 'general');
  if (filter.kind === 'activity') {
    return filter.type ? and(eq(posts.kind, 'activity'), eq(posts.activityType, filter.type)) : eq(posts.kind, 'activity');
  }
  return undefined;
}

// 카드에 필요한 칼럼만. 아이디·실명·부서는 피드에 쓰지 않으므로 가져오지도 않는다(프로필 팝업에서 회원에게만).
const WITH = {
  author: { columns: { id: true, nickname: true, profileImageUrl: true } },
  images: { columns: { storagePath: true }, orderBy: [asc(postImages.position)] },
  season: { columns: { name: true } },
} satisfies NonNullable<Parameters<typeof db.query.posts.findMany>[0]>['with'];

type Row = {
  id: string;
  authorId: string;
  kind: string;
  title: string | null;
  activityType: string | null;
  activityDate: string | null;
  content: string;
  createdAt: Date;
  author: { id: string; nickname: string; profileImageUrl: string | null };
  images: { storagePath: string }[];
  season: { name: string } | null;
};

/**
 * DB 행 → 카드. 화면의 작성자 배지·좋아요·댓글·활동 사진 서명을 종류별로 한 번씩만 조회한다(N+1 방지).
 * 활동 사진은 private 버킷이라 비회원이면 Storage를 부르지도 않는다(HTML에 사진 주소가 남지 않게, 설계 §6).
 */
async function toItems(rows: Row[], viewer: Viewer, now: Date): Promise<FeedItem[]> {
  const ids = rows.map((r) => r.id);
  const viewerId = viewer?.id ?? null;
  const activityPaths = viewer ? rows.filter((r) => r.kind === 'activity').flatMap((r) => r.images.map((i) => i.storagePath)) : [];
  const [badges, likes, comments, signed] = await Promise.all([
    getMemberBadges(rows.map((r) => r.authorId)),
    getLikeSummaries('post', ids, viewerId),
    getComments('post', ids, viewerId),
    activityPaths.length > 0 ? createSignedPhotoUrls(activityPaths) : Promise.resolve([] as (string | null)[]),
  ]);
  const signedByPath = new Map(activityPaths.map((p, i) => [p, signed[i] ?? null]));

  return rows.map((r) => {
    const isActivity = r.kind === 'activity';
    const locked = isActivity && !viewer && r.images.length > 0;
    // 서명에 실패한 사진(null)은 빼고 나머지만 보여준다.
    const images = locked
      ? []
      : r.images.flatMap((img, i) => {
          const src = isActivity ? signedByPath.get(img.storagePath) : postImagePublicUrl(img.storagePath);
          return src ? [{ src, alt: isActivity ? `${r.title} 사진 ${i + 1}` : `게시글 사진 ${i + 1}` }] : [];
        });
    const like = likes.get(r.id) ?? { count: 0, liked: false };
    return {
      id: r.id,
      authorId: r.authorId,
      author: r.author,
      badge: badges.get(r.authorId) ?? null,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      createdLabel: relativeTime(r.createdAt, now),
      activity: isActivity
        ? { title: r.title ?? '', type: r.activityType ?? 'OTHER', seasonName: r.season?.name ?? '', date: r.activityDate ?? '' }
        : null,
      images,
      photoCount: r.images.length,
      photosLocked: locked,
      likeCount: like.count,
      liked: like.liked,
      comments: comments.get(r.id) ?? [],
      canEdit: viewer !== null && (viewer.id === r.authorId || viewer.isAdmin),
    };
  });
}

/**
 * offset부터 한 페이지(최신순). 다음 페이지가 있는지는 1건을 더 읽어 판단한다(전체 수를 세지 않음).
 * 글은 드물게 올라와 커서 대신 offset을 쓰고, 스크롤 중 새 글로 한 칸 밀려 겹친 글은 화면에서 id로 거른다.
 * id는 같은 시각 글의 순서를 고정하는 마지막 기준이다.
 */
export async function getFeedPage(filter: FeedFilter, offset: number, viewer: Viewer, now: Date = new Date()): Promise<FeedPage> {
  const rows: Row[] = await db.query.posts.findMany({
    where: whereOf(filter),
    orderBy: [desc(posts.createdAt), asc(posts.id)],
    with: WITH,
    limit: FEED_PAGE_SIZE + 1,
    offset,
  });
  const page = rows.slice(0, FEED_PAGE_SIZE);
  return { items: await toItems(page, viewer, now), hasMore: rows.length > FEED_PAGE_SIZE };
}

/** 상세(/posts/[id]) 한 건. 없으면 null. id 형식 검사는 호출하는 페이지가 한다. */
export async function getPostView(id: string, viewer: Viewer, now: Date = new Date()): Promise<FeedItem | null> {
  const row: Row | undefined = await db.query.posts.findFirst({ where: eq(posts.id, id), with: WITH });
  if (!row) return null;
  const [item] = await toItems([row], viewer, now);
  return item;
}

import { arrayContains, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { postImages, posts } from '../../drizzle/schema';
import type { MemberBadge } from './badge';
import { getComments, getLikeSummaries, type CommentView } from './community';
import { getMemberBadges } from './member-badges';
import { createSignedPhotoUrls } from './storage-admin';
import type { FeedFilter } from './feed-filter';
import { relativeDay, relativeTime } from './time';

/*
 * 피드 데이터. 설계: docs/superpowers/specs/2026-10-17-unified-post-form-design.md §4
 * 글 종류 구분 없이 모든 글이 같은 모양이다: 사진·내용 + 선택 정보(태그·모임 날짜·시즌).
 * 첫 페이지는 서버 컴포넌트가, 다음 페이지는 서버 액션(loadMoreFeed)이, 상세는 getPostView가 같은 변환(toItems)을 거쳐
 * 세 경로의 카드 모양·권한 표시가 어긋나지 않게 한다.
 */

export type { FeedFilter } from './feed-filter';

/** 사진은 장마다 signed URL을 발급해야 해서 한 번에 많이 그리지 않는다. */
export const FEED_PAGE_SIZE = 10;

export type Viewer = { id: string; isAdmin: boolean } | null;

/** 클라이언트 컴포넌트로 넘기는 카드 한 장. Date 대신 서버에서 만든 문자열만 싣는다(hydration 불일치 방지). */
export type FeedItem = {
  id: string;
  authorId: string;
  author: { id: string; nickname: string; profileImageUrl: string | null };
  badge: MemberBadge | null;
  content: string;
  /**
   * 카드에 보이는 날짜는 하나뿐이다: 모임 날짜를 입력했으면 모임 날짜, 아니면 작성 시각.
   * createdAt은 <time dateTime>용 기계 값(ISO 시각 또는 YYYY-MM-DD), createdLabel은 앱 공통 표기("30분 전", "10월 8일").
   */
  createdAt: string;
  createdLabel: string;
  /** 입력한 경우에만 카드에 보이는 선택 정보 */
  seasonName: string | null;
  tags: string[];
  images: { src: string; alt: string }[];
  photoCount: number;
  /** 비회원이라 사진을 숨겼는지(사진 자리에 로그인 안내를 그린다). 모든 글의 사진은 회원 전용이다. */
  photosLocked: boolean;
  likeCount: number;
  liked: boolean;
  comments: CommentView[];
  /** 수정·삭제 메뉴 표시용. 실제 권한은 서버 액션이 DB로 다시 확인한다. */
  canEdit: boolean;
};

export type FeedPage = { items: FeedItem[]; hasMore: boolean };

// 카드에 필요한 칼럼만. 아이디·실명·부서는 피드에 쓰지 않으므로 가져오지도 않는다(프로필 팝업에서 회원에게만).
const WITH = {
  author: { columns: { id: true, nickname: true, profileImageUrl: true } },
  images: { columns: { storagePath: true }, orderBy: [asc(postImages.position)] },
  season: { columns: { name: true } },
} satisfies NonNullable<Parameters<typeof db.query.posts.findMany>[0]>['with'];

type Row = {
  id: string;
  authorId: string;
  activityDate: string | null;
  tags: string[];
  content: string;
  createdAt: Date;
  author: { id: string; nickname: string; profileImageUrl: string | null };
  images: { storagePath: string }[];
  season: { name: string } | null;
};

/**
 * DB 행 → 카드. 화면의 작성자 배지·좋아요·댓글·사진 서명을 종류별로 한 번씩만 조회한다(N+1 방지).
 * 사진은 모두 private 버킷이라 비회원이면 Storage를 부르지도 않는다(HTML에 사진 주소가 남지 않게).
 */
async function toItems(rows: Row[], viewer: Viewer, now: Date): Promise<FeedItem[]> {
  const ids = rows.map((r) => r.id);
  const viewerId = viewer?.id ?? null;
  const paths = viewer ? rows.flatMap((r) => r.images.map((i) => i.storagePath)) : [];
  const [badges, likes, comments, signed] = await Promise.all([
    getMemberBadges(rows.map((r) => r.authorId)),
    getLikeSummaries('post', ids, viewerId),
    // 카드와 댓글이 같은 기준 시각으로 "N분 전"을 계산하게 now를 넘긴다.
    getComments('post', ids, viewerId, now),
    paths.length > 0 ? createSignedPhotoUrls(paths) : Promise.resolve([] as (string | null)[]),
  ]);
  const signedByPath = new Map(paths.map((p, i) => [p, signed[i] ?? null]));

  return rows.map((r) => {
    const locked = !viewer && r.images.length > 0;
    // 서명에 실패한 사진(null)은 빼고 나머지만 보여준다.
    const images = locked
      ? []
      : r.images.flatMap((img, i) => {
          const src = signedByPath.get(img.storagePath);
          return src ? [{ src, alt: `게시글 사진 ${i + 1}` }] : [];
        });
    const like = likes.get(r.id) ?? { count: 0, liked: false };
    return {
      id: r.id,
      authorId: r.authorId,
      author: r.author,
      badge: badges.get(r.authorId) ?? null,
      content: r.content,
      // 모임 날짜가 있으면 그 날짜를 보여준다(두 날짜를 나란히 두면 헷갈려 하나만 남김).
      createdAt: r.activityDate ?? r.createdAt.toISOString(),
      createdLabel: r.activityDate ? relativeDay(r.activityDate, now) : relativeTime(r.createdAt, now),
      seasonName: r.season?.name ?? null,
      tags: r.tags,
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
 * offset부터 한 페이지(최신순). 태그로 모아 볼 때는 그 태그가 달린 글만(GIN 인덱스, tags @> ARRAY[tag]).
 * 다음 페이지가 있는지는 1건을 더 읽어 판단한다(전체 수를 세지 않음).
 * 글은 드물게 올라와 커서 대신 offset을 쓰고, 스크롤 중 새 글로 한 칸 밀려 겹친 글은 화면에서 id로 거른다.
 * id는 같은 시각 글의 순서를 고정하는 마지막 기준이다.
 */
export async function getFeedPage(filter: FeedFilter, offset: number, viewer: Viewer, now: Date = new Date()): Promise<FeedPage> {
  const rows: Row[] = await db.query.posts.findMany({
    where: filter.tag ? arrayContains(posts.tags, [filter.tag]) : undefined,
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

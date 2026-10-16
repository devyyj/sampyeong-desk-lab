/**
 * 활동 기록 → 게시글 이관 계획(순수 함수). DB 읽기·쓰기는 cli.ts가 하고, 여기서는 "무엇을 어떻게 옮길지"만 계산한다.
 * 설계: docs/superpowers/specs/2026-10-16-feed-activity-merge-design.md §4
 */
import { activityContent } from '../../src/lib/markdown-plain';
import { getActivityType } from '../../src/lib/activity-types';

export type MergeSource = {
  activities: {
    id: string;
    seasonId: number;
    date: string; // YYYY-MM-DD
    type: string;
    title: string;
    bodyMd: string;
    noteMd: string | null;
    sourceKey: string | null;
    createdAt: Date;
  }[];
  photos: { activityId: string; storagePath: string; position: number }[];
  likes: { activityId: string; userId: string; createdAt: Date }[];
  /** comments.activity_id가 있는 댓글 id. 댓글 id는 그대로 두고 post_id만 바꾼다. */
  activityCommentIds: string[];
};

export type MergePlan = {
  posts: {
    id: string;
    authorId: string;
    kind: 'activity';
    title: string;
    activityType: string;
    seasonId: number;
    activityDate: string;
    sourceKey: string | null;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  postImages: { postId: string; storagePath: string; position: number }[];
  postLikes: { postId: string; userId: string; createdAt: Date }[];
  commentIds: string[];
  summary: { posts: number; images: number; likes: number; comments: number };
};

/**
 * 이관 데이터는 모두 비슷한 시각에 들어가 created_at으로는 순서가 의미 없다.
 * 피드에서 시간순으로 읽히도록 모임 날짜 정오(KST)를 게시글 작성 시각으로 쓴다.
 */
const meetingTime = (ymd: string) => new Date(`${ymd}T12:00:00+09:00`);

export function buildMergePlan(source: MergeSource, presidentId: string): MergePlan {
  // id를 그대로 쓴다: 댓글 이동이 단순해지고 /activities/[id] → /posts/[id] 리디렉트도 같은 id로 된다.
  const posts = source.activities.map((a) => ({
    id: a.id,
    authorId: presidentId,
    kind: 'activity' as const,
    title: a.title,
    // 게시글의 활동 종류는 코드가 아니라 이름으로 저장한다(0007, 자유 입력과 같은 형태).
    activityType: getActivityType(a.type).label,
    seasonId: a.seasonId,
    activityDate: a.date,
    sourceKey: a.sourceKey,
    content: activityContent(a.title, a.bodyMd, a.noteMd),
    createdAt: meetingTime(a.date),
    updatedAt: a.createdAt,
  }));
  // 사진 파일은 activity_photos 버킷에 그대로 두고 행만 만든다(활동형 게시글 사진은 그 버킷에서 signed URL로 읽는다).
  const postImages = [...source.photos]
    .sort((x, y) => x.activityId.localeCompare(y.activityId) || x.position - y.position)
    .map((p) => ({ postId: p.activityId, storagePath: p.storagePath, position: p.position }));
  const postLikes = source.likes.map((l) => ({ postId: l.activityId, userId: l.userId, createdAt: l.createdAt }));

  return {
    posts,
    postImages,
    postLikes,
    commentIds: [...source.activityCommentIds],
    summary: { posts: posts.length, images: postImages.length, likes: postLikes.length, comments: source.activityCommentIds.length },
  };
}

/**
 * 기존 활동의 작성자 = 최신 시즌 회장. 하드코딩하지 않고 명부에서 찾는다.
 * 없거나 여러 명이면 잘못된 작성자로 91건을 쓰지 않도록 멈춘다.
 */
export function findPresident(members: { seasonId: number; userId: string; role: string | null }[]): string {
  const latest = Math.max(...members.map((m) => m.seasonId));
  const presidents = members.filter((m) => m.seasonId === latest && m.role === '회장');
  if (presidents.length !== 1) {
    throw new Error(`최신 시즌(${latest})의 회장이 ${presidents.length}명입니다. 회장이 정확히 1명이어야 이관할 수 있습니다.`);
  }
  return presidents[0].userId;
}

import { getSession } from "@/lib/session";
import { db } from "@/db";
import { desc } from "drizzle-orm";
import { posts } from "../../drizzle/schema";
import UserName from "@/components/UserName";
import Avatar from "@/components/Avatar";
import TopBar from "@/components/TopBar";
import EmptyState from "@/components/EmptyState";
import PhotoCarousel from "@/components/PhotoCarousel";
import PostCaption from "@/components/PostCaption";
import PostMenu from "@/components/PostMenu";
import PostReactions from "@/components/PostReactions";
import { getMemberBadges } from "@/lib/member-badges";
import { postImagePublicUrl } from "@/lib/post-images";
import { getComments, getLikeSummaries } from "@/lib/community";
import { relativeTime } from "@/lib/time";

export const dynamic = 'force-dynamic';

/**
 * 자유게시판 피드(인스타그램형).
 * 카드 구성: 작성자 줄(아바타·닉네임·상대 시간·본인 글이면 ···) → 화면 폭 사진 캐러셀 → ♡ 💬 → 본문 → 댓글 모두 보기.
 * 사진 없는 글은 본문이 주인공이라 본문을 반응 줄 위에 크게 둔다.
 */
export default async function Page() {
  const session = await getSession();

  const allPosts = await db.query.posts.findMany({
    orderBy: [desc(posts.createdAt)],
    with: {
      // 아이디·실명·부서는 피드에 쓰지 않으므로 가져오지도 않는다(실명·부서는 프로필 팝업에서 회원에게만).
      author: { columns: { id: true, nickname: true, profileImageUrl: true } },
      images: { columns: { storagePath: true }, orderBy: (images, { asc }) => [asc(images.position)] },
    },
  });
  // 화면의 모든 작성자 배지·좋아요·댓글을 종류별로 한 번에 조회한다(N+1 방지).
  const postIds = allPosts.map((post) => post.id);
  const viewerId = session?.userId ?? null;
  const [badges, likes, commentsByPost] = await Promise.all([
    getMemberBadges(allPosts.map((post) => post.authorId)),
    getLikeSummaries('post', postIds, viewerId),
    getComments('post', postIds, viewerId),
  ]);
  // 관리자 여부는 댓글 삭제 버튼을 보여줄지 정하는 데만 쓴다. 실제 권한은 deleteComment가 DB로 다시 확인한다.
  const viewer = session ? { id: session.userId, isAdmin: session.isAdmin } : null;
  // 한 번의 요청 안에서는 모든 카드가 같은 기준 시각으로 "N분 전"을 계산하게 한다.
  const now = new Date();

  return (
    <div>
      <TopBar title="자유게시판" />

      {allPosts.length === 0 ? (
        <EmptyState title="아직 등록된 게시글이 없어요" description="오른쪽 아래 ＋ 버튼으로 첫 이야기를 남겨보세요." />
      ) : (
        <div className="divide-y divide-border">
          {allPosts.map((post) => {
            const createdAt = new Date(post.createdAt);
            const images = post.images.map((img, i) => ({
              src: postImagePublicUrl(img.storagePath),
              alt: `게시글 사진 ${i + 1}`,
            }));
            const hasImages = images.length > 0;
            const reactions = {
              postId: post.id,
              liked: likes.get(post.id)?.liked ?? false,
              likeCount: likes.get(post.id)?.count ?? 0,
              comments: commentsByPost.get(post.id) ?? [],
              viewer,
              loginHref: '/login?redirect=%2F',
            };

            return (
              <article key={post.id} className="py-3">
                <header className="flex items-center gap-2.5 h-11">
                  <Avatar src={post.author.profileImageUrl} name={post.author.nickname} size={34} />
                  <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                    <UserName userId={post.author.id} nickname={post.author.nickname} badge={badges.get(post.authorId) ?? null} />
                    <span className="text-muted-foreground text-sm" aria-hidden="true">·</span>
                    <time dateTime={createdAt.toISOString()} className="text-sm text-muted-foreground whitespace-nowrap">
                      {relativeTime(createdAt, now)}
                    </time>
                  </div>
                  {session?.userId === post.authorId && <PostMenu postId={post.id} />}
                </header>

                {hasImages ? (
                  <>
                    {/* 모바일에서는 좌우 여백(main의 px-4)을 상쇄해 사진을 화면 끝까지 채운다. */}
                    <div className="-mx-4 mt-1.5 sm:mx-0 sm:rounded-xl sm:overflow-hidden">
                      <PhotoCarousel images={images} />
                    </div>
                    <div className="mt-1">
                      <PostReactions {...reactions}>
                        <PostCaption content={post.content} />
                      </PostReactions>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-1 mb-1">
                      <PostCaption content={post.content} large />
                    </div>
                    <PostReactions {...reactions} />
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

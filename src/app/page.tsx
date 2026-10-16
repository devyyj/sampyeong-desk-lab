import { getSession } from "@/lib/session";
import Link from "next/link";
import { db } from "@/db";
import { desc } from "drizzle-orm";
import { posts } from "../../drizzle/schema";
import DeletePostButton from "@/components/DeletePostButton";
import ImageLightbox from "@/components/ImageLightbox";
import UserName from "@/components/UserName";
import { getMemberBadges } from "@/lib/member-badges";
import { postImagePublicUrl } from "@/lib/post-images";
import { getComments, getLikeSummaries } from "@/lib/community";
import PostReactions from "@/components/PostReactions";

export const dynamic = 'force-dynamic';

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight">자유게시판</h1>
        {session && (
          <Link
            href="/posts/write"
            className="px-4 py-2 bg-foreground text-background rounded-full hover:bg-foreground/90 transition-colors text-sm font-semibold"
          >
            글쓰기
          </Link>
        )}
      </div>
      
      {allPosts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground bg-card border border-border rounded-xl">
          <p>아직 등록된 게시글이 없습니다.</p>
          <p className="text-sm mt-2">첫 번째 게시글을 남겨보세요!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {allPosts.map((post) => (
            <article key={post.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {post.author.profileImageUrl ? (
                      <img src={post.author.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">
                        {[...post.author.nickname][0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <UserName userId={post.author.id} nickname={post.author.nickname} badge={badges.get(post.authorId) ?? null} />
                </div>
                {session?.userId === post.authorId && (
                  <div className="flex items-center gap-2">
                    <Link href={`/posts/${post.id}/edit`} className="text-xs text-blue-500 hover:underline">수정</Link>
                    <DeletePostButton id={post.id} />
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                {/* 사진이 피드를 다 차지하지 않도록 본문 아래 작은 썸네일로 두고, 누르면 팝업으로 크게 본다. */}
                {post.images.length > 0 && (
                  <div className="mt-3">
                    <ImageLightbox
                      images={post.images.map((img, i) => ({
                        src: postImagePublicUrl(img.storagePath),
                        alt: `게시글 사진 ${i + 1}`,
                      }))}
                    />
                  </div>
                )}
                <div className="mt-4 text-xs text-muted-foreground">
                  {new Date(post.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>

              <div className="px-4 pb-4">
                <PostReactions
                  postId={post.id}
                  liked={likes.get(post.id)?.liked ?? false}
                  likeCount={likes.get(post.id)?.count ?? 0}
                  comments={commentsByPost.get(post.id) ?? []}
                  viewer={viewer}
                  loginHref="/login?redirect=%2F"
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}


import { getSession } from "@/lib/session";
import Link from "next/link";
import { db } from "@/db";
import { desc } from "drizzle-orm";
import { posts } from "../../drizzle/schema";
import DeletePostButton from "@/components/DeletePostButton";

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();

  const allPosts = await db.query.posts.findMany({
    orderBy: [desc(posts.createdAt)],
    with: {
      author: true,
    },
  });

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
                        {post.author.username[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{post.author.username}</div>
                    <div className="text-xs text-muted-foreground">{post.author.department}</div>
                  </div>
                </div>
                {session?.userId === post.authorId && (
                  <div className="flex items-center gap-2">
                    <Link href={`/posts/${post.id}/edit`} className="text-xs text-blue-500 hover:underline">수정</Link>
                    <DeletePostButton id={post.id} />
                  </div>
                )}
              </div>
              
              {post.imageUrl && (
                <div className="w-full aspect-square bg-muted relative">
                  <img src={post.imageUrl} alt="Post image" className="w-full h-full object-cover" />
                </div>
              )}
              
              <div className="p-4">
                <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                <div className="mt-4 text-xs text-muted-foreground">
                  {new Date(post.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}


import { db } from "@/db";
import { posts } from "../../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import PostForm from "@/components/PostForm";
import { postImagePublicUrl } from "@/lib/post-images";
import { isUuid } from "@/lib/uuid";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');
  // 형식이 다른 id로 uuid 컬럼을 조회하면 500이 나므로 바로 돌려보낸다.
  if (!isUuid(id)) redirect('/');

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { images: { orderBy: (images, { asc }) => [asc(images.position)] } },
  });
  if (!post || post.authorId !== session.userId) {
    redirect('/');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">게시글 수정</h1>
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
        <PostForm
          mode="edit"
          post={{
            id: post.id,
            content: post.content,
            images: post.images.map((img) => ({ id: img.id, url: postImagePublicUrl(img.storagePath) })),
          }}
        />
      </div>
    </div>
  );
}

import { db } from "@/db";
import { posts } from "../../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { EditPostForm } from "./edit-form";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  if (!post || post.authorId !== session.userId) {
    redirect('/');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">게시글 수정</h1>
      
      <EditPostForm post={post} />
    </div>
  );
}

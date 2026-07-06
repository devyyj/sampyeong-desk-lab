import { db } from "@/db";
import { posts } from "../../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { updatePost } from "@/app/actions/post";

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
      
      <form action={updatePost} className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
        <input type="hidden" name="id" value={post.id} />
        
        <div>
          <label htmlFor="content" className="block text-sm font-medium mb-2">내용</label>
          <textarea
            id="content"
            name="content"
            rows={5}
            defaultValue={post.content}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none"
            placeholder="수정할 내용을 입력하세요"
            required
          />
        </div>
        
        <div className="flex justify-end gap-3 pt-2">
          <a href="/" className="px-5 py-2.5 rounded-full font-medium hover:bg-muted transition-colors">
            취소
          </a>
          <button
            type="submit"
            className="px-5 py-2.5 bg-foreground text-background rounded-full font-medium hover:bg-foreground/90 transition-colors"
          >
            수정완료
          </button>
        </div>
      </form>
    </div>
  );
}

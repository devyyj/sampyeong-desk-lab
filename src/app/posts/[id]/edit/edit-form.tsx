'use client';

import { useActionState } from 'react';
import { updatePost } from '@/app/actions/post';
import Link from 'next/link';

type PostType = {
  id: string;
  content: string;
};

export function EditPostForm({ post }: { post: PostType }) {
  const [state, formAction] = useActionState(updatePost, null as any);

  return (
    <form action={formAction} className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
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
      
      {state?.error && (
        <p className="text-sm text-red-500 font-medium">{state.error}</p>
      )}
      
      <div className="flex justify-end gap-3 pt-2">
        <Link href="/" className="px-5 py-2.5 rounded-full font-medium hover:bg-muted transition-colors">
          취소
        </Link>
        <button
          type="submit"
          className="px-5 py-2.5 bg-foreground text-background rounded-full font-medium hover:bg-foreground/90 transition-colors"
        >
          수정완료
        </button>
      </div>
    </form>
  );
}

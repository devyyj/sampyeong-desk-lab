'use client';

import { useActionState } from 'react';
import { createPost } from '@/app/actions/post';

export default function PostWritePage() {
  const [state, formAction] = useActionState(createPost, null as any);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
        <h1 className="text-xl font-bold mb-6 text-foreground">새 게시글 작성</h1>
        
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-foreground mb-1">
              내용
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={5}
              className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="무슨 생각을 하고 계신가요?"
            />
          </div>

          <div>
            <label htmlFor="image" className="block text-sm font-medium text-foreground mb-1">
              사진 첨부
            </label>
            <input
              type="file"
              id="image"
              name="image"
              accept="image/*"
              className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 text-sm text-muted-foreground"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-500 font-medium">{state.error}</p>
          )}

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              게시하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

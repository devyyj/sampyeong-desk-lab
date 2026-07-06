'use client';

import { useActionState } from 'react';
import { createPost } from '@/app/actions/post';

export default function PostWritePage() {
  const [state, formAction] = useActionState(createPost, null as any);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">새 게시글 작성</h1>
          <p className="text-sm text-muted-foreground mt-1">보드게임 후기나 팀원들과 나누고 싶은 이야기를 자유롭게 작성해주세요.</p>
        </div>
        
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-foreground mb-1">
              내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={5}
              className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="무슨 생각을 하고 계신가요? (최소 5자 이상)"
            />
          </div>

          <div>
            <label htmlFor="image" className="block text-sm font-medium text-foreground mb-1">
              사진 첨부 (선택)
            </label>
            <input
              type="file"
              id="image"
              name="image"
              accept="image/*"
              className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 text-sm text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">함께 즐긴 사진을 공유해보세요!</p>
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

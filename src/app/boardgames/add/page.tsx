'use client';

import { useActionState } from 'react';
import { addBoardGame } from '@/app/actions/boardgame';
import Link from 'next/link';

export default function AddBoardGamePage() {
  const [state, formAction] = useActionState(addBoardGame, null as any);

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
        <h1 className="text-xl font-bold mb-6 text-foreground">새 보드게임 등록</h1>
        
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
              보드게임 이름 *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="예: 스플렌더"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="recommendedPlayers" className="block text-sm font-medium text-foreground mb-1">
                추천 인원
              </label>
              <input
                type="text"
                id="recommendedPlayers"
                name="recommendedPlayers"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="예: 2~4명"
              />
            </div>
            <div>
              <label htmlFor="playTime" className="block text-sm font-medium text-foreground mb-1">
                플레이 시간
              </label>
              <input
                type="text"
                id="playTime"
                name="playTime"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="예: 30분"
              />
            </div>
          </div>

          <div>
            <label htmlFor="image" className="block text-sm font-medium text-foreground mb-1">
              썸네일 이미지 첨부
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

          <div className="flex justify-end gap-3 pt-4">
            <Link
              href="/boardgames"
              className="px-6 py-2 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition-colors"
            >
              취소
            </Link>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              등록하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

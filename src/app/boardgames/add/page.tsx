'use client';

import { useActionState } from 'react';
import { addBoardGame } from '@/app/actions/boardgame';
import Link from 'next/link';

export default function AddBoardGamePage() {
  const [state, formAction] = useActionState(addBoardGame, null as any);

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">새 보드게임 등록</h1>
          <p className="text-sm text-muted-foreground mt-1">회사에 새로 들어온 보드게임을 등록해주세요.</p>
        </div>
        
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
              보드게임 이름 <span className="text-red-500">*</span>
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
                placeholder="예: 30분~1시간"
              />
            </div>
          </div>

          {/* 보드게임은 보관 상태 대신 공용 보관함에 있는지만 관리한다. 대부분 개인 보유라 기본은 꺼 둔다. */}
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              name="inSharedCabinet"
              className="h-4 w-4 rounded border-border accent-primary-600"
            />
            공용 보관함에 보관
          </label>

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

import { db } from "@/db";
import { boardGames } from "../../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { updateBoardGame } from "@/app/actions/boardgame";

export default async function EditBoardGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const [game] = await db.select().from(boardGames).where(eq(boardGames.id, id));
  if (!game) {
    redirect('/boardgames');
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight">보드게임 수정</h1>
      </div>

      <form action={updateBoardGame} className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-6">
        <input type="hidden" name="id" value={game.id} />
        
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">보드게임 이름 *</label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={game.name}
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="recommendedPlayers" className="block text-sm font-medium mb-2">추천 인원 (선택)</label>
            <input
              type="text"
              id="recommendedPlayers"
              name="recommendedPlayers"
              defaultValue={game.recommendedPlayers || ''}
              placeholder="예: 2~4명"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="playTime" className="block text-sm font-medium mb-2">플레이 시간 (선택)</label>
            <input
              type="text"
              id="playTime"
              name="playTime"
              defaultValue={game.playTime || ''}
              placeholder="예: 30~60분"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-2">상태</label>
            <select
              id="status"
              name="status"
              defaultValue={game.status}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            >
              <option value="AVAILABLE">보관 중 (AVAILABLE)</option>
              <option value="PLAYING">플레이 중 (PLAYING)</option>
              <option value="BORROWED">대여 중 (BORROWED)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
          <a href="/boardgames" className="px-5 py-2.5 rounded-full font-medium hover:bg-muted transition-colors">
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

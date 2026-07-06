import { db } from "@/db";
import { boardGames } from "../../../drizzle/schema";
import { desc } from "drizzle-orm";
import { getSession } from "@/lib/session";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function BoardGamesPage() {
  const session = await getSession();
  const allGames = await db.query.boardGames.findMany({
    orderBy: [desc(boardGames.createdAt)],
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">보드게임 현황</h1>
          <p className="text-sm text-muted-foreground mt-1">SDL이 보유하고 있는 보드게임 목록입니다.</p>
        </div>
        {session && (
          <Link
            href="/boardgames/add"
            className="px-4 py-2 bg-foreground text-background rounded-full hover:bg-foreground/90 transition-colors text-sm font-semibold whitespace-nowrap"
          >
            새 보드게임 등록
          </Link>
        )}
      </div>

      {allGames.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground bg-card border border-border rounded-xl">
          <p>등록된 보드게임이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allGames.map((game) => (
            <div key={game.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col group">
              <div className="w-full aspect-video bg-muted relative overflow-hidden">
                {game.thumbnailUrl ? (
                  <img src={game.thumbnailUrl} alt={game.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium">
                    No Image
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full shadow-sm backdrop-blur-md ${
                    game.status === 'AVAILABLE' ? 'bg-green-500/90 text-white' : 
                    game.status === 'PLAYING' ? 'bg-blue-500/90 text-white' : 'bg-orange-500/90 text-white'
                  }`}>
                    {game.status === 'AVAILABLE' ? '보관 중' : 
                     game.status === 'PLAYING' ? '플레이 중' : '대여 중'}
                  </span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-lg text-foreground mb-3">{game.name}</h3>
                
                <div className="space-y-2 mt-auto">
                  {game.recommendedPlayers && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="w-20 font-medium text-foreground">추천 인원</span>
                      <span>{game.recommendedPlayers}</span>
                    </div>
                  )}
                  {game.playTime && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="w-20 font-medium text-foreground">플레이 시간</span>
                      <span>{game.playTime}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

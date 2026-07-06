import { db } from "@/db";
import { boardGames } from "../../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { EditBoardGameForm } from "./edit-form";

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

      <EditBoardGameForm game={game} />
    </div>
  );
}

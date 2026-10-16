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

  // 상단 바(취소 | 보드게임 수정 | 수정완료)는 폼이 그린다.
  return <EditBoardGameForm game={game} />;
}

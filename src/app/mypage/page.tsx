import { getSession } from "@/lib/session";
import { db } from "@/db";
import { users } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import MypageForm from "./MypageForm";

export const dynamic = 'force-dynamic';

export default async function Mypage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight">마이페이지</h1>
        <p className="text-sm text-muted-foreground mt-1">내 프로필 정보를 관리하세요.</p>
      </div>

      <div className="bg-card border border-border p-8 rounded-2xl shadow-sm">
        <MypageForm user={user} />
      </div>
    </div>
  );
}

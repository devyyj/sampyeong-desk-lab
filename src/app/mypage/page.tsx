import { getSession } from "@/lib/session";
import { db } from "@/db";
import { users } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import MypageForm from "./MypageForm";
import TopBar from "@/components/TopBar";

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
    <div>
      {/* MY 탭 허브(/my)에서 들어오는 프로필 편집 화면. 제목은 E2E·기존 링크와 맞춰 '마이페이지'로 둔다. */}
      <TopBar title="마이페이지" backHref="/my" backLabel="MY로 돌아가기" />
      <MypageForm user={user} />
    </div>
  );
}

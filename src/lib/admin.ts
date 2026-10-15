import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '../../drizzle/schema';
import { getSession } from '@/lib/session';

/**
 * 현재 로그인한 사용자가 관리자면 그 사용자 행을, 아니면 null을 돌려준다.
 * 세션(JWT)의 isAdmin은 발급 시점의 값이라 관리자 해제가 즉시 반영되지 않는다.
 * 그래서 관리자 권한이 필요한 페이지·액션은 반드시 이 함수로 DB를 다시 확인한다.
 */
export async function getAdminUser(): Promise<typeof users.$inferSelect | null> {
  const session = await getSession();
  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  return user?.isAdmin ? user : null;
}

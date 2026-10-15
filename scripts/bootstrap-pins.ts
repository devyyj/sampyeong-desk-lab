// 회원가입 제거에 따른 1회성 초기화: PIN이 없는 회원(Confluence 이관 회원)에게 초기 PIN을 주고 관리자를 지정한다.
// 실행: npm run bootstrap:pins (진입점은 bootstrap-pins.main.ts)
import { eq, isNull } from 'drizzle-orm';
import { users } from '../drizzle/schema';
import { hashPIN, INITIAL_PIN } from '../src/lib/auth-utils';
import type { Db } from './import-confluence/load';

/**
 * - PIN이 없는 사용자 전원: 초기 PIN + mustChangePin=true (첫 로그인 때 본인 PIN으로 바꾸게 함)
 * - 이미 PIN이 있는 사용자는 건드리지 않는다: 재실행해도 회원이 바꾼 PIN이 초기화되지 않는다.
 * - 관리자 계정이 없으면 아무것도 반영하지 않고(트랜잭션 롤백) 실패한다.
 */
export async function bootstrapPins(db: Db, adminUsername: string): Promise<{ pinsAssigned: number; adminSet: boolean }> {
  // bcrypt는 느리므로 해시는 한 번만 만들어 모든 행에 쓴다(솔트가 같아지지만 어차피 모두 같은 공개된 초기 PIN이다).
  const pinHash = await hashPIN(INITIAL_PIN);

  return db.transaction(async (tx) => {
    const assigned = await tx.update(users)
      .set({ pinHash, mustChangePin: true, updatedAt: new Date() })
      .where(isNull(users.pinHash))
      .returning({ id: users.id });

    const admins = await tx.update(users)
      .set({ isAdmin: true, updatedAt: new Date() })
      .where(eq(users.username, adminUsername))
      .returning({ id: users.id });
    if (admins.length === 0) throw new Error(`관리자 계정 없음: ${adminUsername}`);

    return { pinsAssigned: assigned.length, adminSet: true };
  });
}

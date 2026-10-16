'use server';

import { eq, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { users } from '../../../drizzle/schema';
import { getAdminUser } from '@/lib/admin';
import { hashPIN, isValidPin, INITIAL_PIN } from '@/lib/auth-utils';
import { NICKNAME_MAX } from '@/lib/nickname';
import { isUniqueViolation } from '@/lib/pg-errors';

type AdminActionResult = { error: string } | { success: string };

const FORBIDDEN: AdminActionResult = { error: '권한이 없습니다.' };
const INVALID_PIN: AdminActionResult = { error: '비밀번호는 4자리 숫자여야 합니다.' };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

// PIN 입력란을 비워 두면 기본 초기 PIN(1234)을 쓴다. 어느 쪽이든 받은 사람은 첫 로그인 때 바꿔야 한다.
const pinOrDefault = (formData: FormData) => text(formData, 'pin') || INITIAL_PIN;

function revalidateMemberPages() {
  revalidatePath('/admin/members');
  revalidatePath('/members');
}

/** 관리자가 새 회원 계정을 발급한다. 회원가입이 없으므로 계정은 이 경로로만 생긴다. */
export async function createMember(prevState: unknown, formData: FormData): Promise<AdminActionResult> {
  // UI에서 관리자만 폼을 보더라도 Server Action은 직접 호출될 수 있으므로 서버에서 매번 확인한다.
  if (!(await getAdminUser())) return FORBIDDEN;

  // 아이디 앞뒤 공백이 저장되면 로그인할 때 일치하지 않으므로 제거한다.
  const username = text(formData, 'username');
  const displayName = text(formData, 'displayName');
  const department = text(formData, 'department');
  const pin = pinOrDefault(formData);

  if (!username || !displayName || !department) {
    return { error: '아이디, 이름, 부서를 모두 입력해주세요.' };
  }
  // 닉네임 최초값이 아이디인데 닉네임은 20자까지라, 그보다 긴 아이디는 받지 않는다(사내 ACE ID는 이 범위 안).
  if ([...username].length > NICKNAME_MAX) return { error: `아이디는 ${NICKNAME_MAX}자 이하여야 합니다.` };
  if (!isValidPin(pin)) return INVALID_PIN;

  try {
    // 같은 아이디, 또는 이 아이디와 (대소문자 무시) 같은 닉네임을 쓰는 회원이 있으면 만들 수 없다.
    const existing = await db.select().from(users).where(
      or(eq(users.username, username), sql`lower(${users.nickname}) = lower(${username})`),
    );
    if (existing.some((u) => u.username === username)) {
      return { error: '이미 존재하는 아이디입니다.' };
    }
    if (existing.length > 0) {
      return { error: '이미 사용 중인 닉네임과 같은 아이디입니다.' };
    }
    await db.insert(users).values({
      username,
      nickname: username, // 닉네임 최초값은 아이디. 회원이 마이페이지에서 바꾼다.
      displayName, department,
      pinHash: await hashPIN(pin),
      mustChangePin: true,
    });
  } catch (e) {
    // 사전 조회와 insert 사이에 같은 아이디/닉네임이 생기면 DB 고유 제약이 막는다.
    if (isUniqueViolation(e)) return { error: '이미 존재하는 아이디 또는 닉네임입니다.' };
    console.error('Create member error', e);
    return { error: '회원 생성 중 오류가 발생했습니다.' };
  }

  revalidateMemberPages();
  return { success: `${username} 회원을 생성했습니다.` };
}

/** 관리자가 회원의 PIN을 새로 정한다(분실 시 초기화). 받은 회원은 다음 로그인 때 PIN을 바꿔야 한다. */
export async function resetMemberPin(prevState: unknown, formData: FormData): Promise<AdminActionResult> {
  if (!(await getAdminUser())) return FORBIDDEN;

  const userId = text(formData, 'userId');
  const pin = pinOrDefault(formData);
  if (!isValidPin(pin)) return INVALID_PIN;

  try {
    const [target] = await db.select().from(users).where(eq(users.id, userId));
    if (!target) {
      return { error: '회원을 찾을 수 없습니다.' };
    }
    await db.update(users)
      .set({ pinHash: await hashPIN(pin), mustChangePin: true, updatedAt: new Date() })
      .where(eq(users.id, target.id));

    revalidateMemberPages();
    return { success: `${target.username} 회원의 비밀번호를 초기화했습니다.` };
  } catch (e) {
    console.error('Reset member PIN error', e);
    return { error: '비밀번호 초기화 중 오류가 발생했습니다.' };
  }
}

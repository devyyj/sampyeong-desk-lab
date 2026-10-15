'use server';

import { db } from '@/db';
import { users } from '../../../drizzle/schema';
import { hashPIN, verifyPIN } from '@/lib/auth-utils';
import { createSession, deleteSession } from '@/lib/session';
import { and, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export async function signup(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const pin = formData.get('pin') as string;
  const confirmPin = formData.get('confirmPin') as string;
  const department = formData.get('department') as string;

  if (!username || !pin || !confirmPin || !department) {
    return { error: '모든 항목을 입력해주세요.' };
  }

  if (pin !== confirmPin) {
    return { error: '비밀번호가 일치하지 않습니다.' };
  }

  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return { error: '비밀번호는 4자리 숫자여야 합니다.' };
  }

  try {
    const [existingUser] = await db.select().from(users).where(eq(users.username, username));
    if (existingUser && existingUser.pinHash !== null) {
      return { error: '이미 존재하는 아이디입니다.' };
    }

    const pinHash = await hashPIN(pin);

    if (existingUser) {
      // pin_hash가 NULL = Confluence에서 이관된 사전 등록(미가입) 계정.
      // 새 행을 만들지 않고 기존 행에 PIN을 채워 연결(claim)해야 시즌 명부/보유 게임 기록이 이어진다.
      // WHERE에 pin_hash IS NULL을 다시 거는 이유: 조회와 UPDATE 사이에 다른 요청이 먼저 가입했다면
      // 0행이 갱신되도록 해서, 나중 요청이 남의 PIN을 덮어쓰지 못하게 한다(동시 가입 경합 방지).
      const [claimedUser] = await db.update(users)
        .set({ pinHash, department, updatedAt: new Date() })
        .where(and(eq(users.username, username), isNull(users.pinHash)))
        .returning();
      if (!claimedUser) {
        return { error: '이미 존재하는 아이디입니다.' };
      }
      // redirect()는 try 밖(함수 끝)에서 호출한다. try 안에서 부르면 NEXT_REDIRECT 예외가 catch에 잡혀 오류로 바뀐다.
      await createSession(claimedUser.id, claimedUser.username);
    } else {
      const [newUser] = await db.insert(users).values({
        username,
        pinHash,
        department,
      }).returning();

      await createSession(newUser.id, newUser.username);
    }
  } catch (e) {
    console.error('Signup error', e);
    return { error: '회원가입 처리 중 오류가 발생했습니다.' };
  }

  redirect('/');
}

export async function login(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const pin = formData.get('pin') as string;
  const redirectTo = (formData.get('redirect') as string) || '/';

  if (!username || !pin) {
    return { error: '아이디와 비밀번호를 입력해주세요.' };
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    // 사전 등록(미가입) 계정은 PIN이 없으므로 로그인 불가. 계정 존재 여부가 드러나지 않도록 같은 메시지를 쓴다.
    if (!user || !user.pinHash) {
      return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' };
    }

    const isValid = await verifyPIN(pin, user.pinHash);
    if (!isValid) {
      return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' };
    }

    await createSession(user.id, user.username);
  } catch (e) {
    console.error('Login error', e);
    return { error: '로그인 처리 중 오류가 발생했습니다.' };
  }

  redirect(redirectTo);
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}


'use server';

import { db } from '@/db';
import { users } from '../../../drizzle/schema';
import { hashPIN, verifyPIN } from '@/lib/auth-utils';
import { createSession, deleteSession } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export async function signup(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const pin = formData.get('pin') as string;
  const department = formData.get('department') as string;

  if (!username || !pin || !department) {
    return { error: '모든 항목을 입력해주세요.' };
  }

  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return { error: '비밀번호는 4자리 숫자여야 합니다.' };
  }

  try {
    const existingUser = await db.select().from(users).where(eq(users.username, username));
    if (existingUser.length > 0) {
      return { error: '이미 존재하는 아이디입니다.' };
    }

    const pinHash = await hashPIN(pin);

    const [newUser] = await db.insert(users).values({
      username,
      pinHash,
      department,
    }).returning();

    await createSession(newUser.id, newUser.username);
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
    if (!user) {
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


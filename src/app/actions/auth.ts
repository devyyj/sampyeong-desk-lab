'use server';

import { db } from '@/db';
import { users } from '../../../drizzle/schema';
import { verifyPIN } from '@/lib/auth-utils';
import { createSession, deleteSession } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

/**
 * 로그인 후 이동 경로 검증. redirect 값은 URL 쿼리(/login?redirect=...)에서 오므로 공격자가 조작할 수 있다.
 * 외부 URL("https://...")이나 프로토콜 상대 경로("//host", "/\host" — 브라우저가 "//"로 해석)를 그대로
 * redirect()에 넘기면 로그인 직후 외부 사이트로 보내는 오픈 리다이렉트가 되므로, 사이트 내부 경로만 허용한다.
 */
function safeRedirectPath(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }
  return value;
}

export async function login(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const pin = formData.get('pin') as string;
  const redirectTo = safeRedirectPath(formData.get('redirect'));

  if (!username || !pin) {
    return { error: '아이디와 비밀번호를 입력해주세요.' };
  }

  let mustChangePin = false;
  try {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    // PIN이 없는 계정(관리자가 아직 PIN을 발급하지 않은 계정)은 로그인 불가. 계정 존재 여부가 드러나지 않도록 같은 메시지를 쓴다.
    if (!user || !user.pinHash) {
      return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' };
    }

    const isValid = await verifyPIN(pin, user.pinHash);
    if (!isValid) {
      return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' };
    }

    await createSession(user.id, user.username, { isAdmin: user.isAdmin, mustChangePin: user.mustChangePin });
    mustChangePin = user.mustChangePin;
  } catch (e) {
    console.error('Login error', e);
    return { error: '로그인 처리 중 오류가 발생했습니다.' };
  }

  // 관리자가 발급/초기화한 PIN으로 로그인했다면 원래 가려던 곳 대신 PIN 변경 화면으로 보낸다.
  redirect(mustChangePin ? '/change-pin' : redirectTo);
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}


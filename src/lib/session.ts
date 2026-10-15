import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.SESSION_SECRET || 'super-secret-key-for-development';
const encodedKey = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  userId: string;
  username: string;
  // 화면 분기·페이지 이동 제어용. 관리자 권한이 필요한 동작은 이 값이 아니라 DB(users.is_admin)로 판단한다.
  isAdmin: boolean;
  // true면 middleware가 PIN 변경 화면(/change-pin) 외의 페이지 접근을 막는다.
  mustChangePin: boolean;
  expiresAt: Date;
};

export type SessionFlags = Pick<SessionPayload, 'isAdmin' | 'mustChangePin'>;

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    });
    // 이 필드가 생기기 전에 발급된 토큰(배포 직후 남아 있는 쿠키)도 안전하게 해석되도록 기본값 false를 채운다.
    return { ...payload, isAdmin: payload.isAdmin === true, mustChangePin: payload.mustChangePin === true } as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}

export async function createSession(userId: string, username: string, flags: SessionFlags) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({ userId, username, ...flags, expiresAt });
  
  const cookieStore = await cookies();
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return null;
  return await decrypt(session);
}

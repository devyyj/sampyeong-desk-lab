import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const DEV_SESSION_SECRET = 'super-secret-key-for-development';
const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * 세션 JWT 서명 키를 정한다.
 * 개발용 기본 키는 저장소에 공개되어 있어, 운영에서 이 키로 서명하면 누구나 임의의 세션(다른 회원, isAdmin 등)을
 * 위조할 수 있다. 실제로 Vercel에 SESSION_SECRET이 빠진 채 기본 키로 운영된 적이 있어,
 * production에서는 키가 없거나 짧으면 조용히 기본 키로 떨어지지 않고 오류를 낸다.
 */
export function resolveSessionSecret(env: { SESSION_SECRET?: string; NODE_ENV?: string }): string {
  const secret = env.SESSION_SECRET;
  if (env.NODE_ENV !== 'production') return secret || DEV_SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET 환경 변수가 설정되지 않았습니다. 운영 환경에서는 필수입니다.');
  }
  if (secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET은 운영 환경에서 ${MIN_PRODUCTION_SECRET_LENGTH}자 이상이어야 합니다.`);
  }
  return secret;
}

// 모듈 로드 시점이 아니라 서명/검증할 때 키를 읽는다. `next build`도 NODE_ENV=production으로 모듈을 평가하므로,
// 로드 시점에 검사하면 SESSION_SECRET이 없는 로컬 빌드(AGENTS.md 8번의 배포 전 빌드 확인)가 실패하기 때문이다.
let cachedKey: Uint8Array | null = null;
function getKey() {
  cachedKey ??= new TextEncoder().encode(
    resolveSessionSecret({ SESSION_SECRET: process.env.SESSION_SECRET, NODE_ENV: process.env.NODE_ENV }),
  );
  return cachedKey;
}

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
    .sign(getKey());
}

export async function decrypt(session: string | undefined = '') {
  // 키 설정 오류는 아래 try/catch에 삼켜지면 "모두 로그아웃됨"으로만 보여 원인을 찾기 어렵다. 그래서 try 밖에서 읽어 그대로 던진다.
  const key = getKey();
  try {
    const { payload } = await jwtVerify(session, key, {
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

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/session';
import { guardRoute } from '@/lib/route-guard';

// 페이지 접근 규칙(로그인 필요 경로, PIN 변경 강제)은 테스트 가능한 순수 함수 guardRoute에 둔다.
export async function middleware(req: NextRequest) {
  const session = await decrypt(req.cookies.get('session')?.value);
  const target = guardRoute(req.nextUrl.pathname, session);
  return target ? NextResponse.redirect(new URL(target, req.url)) : NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};

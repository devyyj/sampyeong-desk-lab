import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '../../../drizzle/schema';
import { getSession } from '@/lib/session';
import { logout } from '@/app/actions/auth';
import TopBar from '@/components/TopBar';
import Avatar from '@/components/Avatar';
import { BookIcon, BoxIcon, ChevronRightIcon, LogoutIcon, PencilIcon, ShieldIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

/**
 * MY 탭 허브. GNB가 없어지면서 계정·안내 메뉴가 모두 여기로 모였다.
 * /mypage(프로필 편집)는 route-guard가 보호하므로, 비회원도 들어와 로그인·동호회 안내를 찾을 수 있게 별도의 공개 경로로 둔다.
 * 비회원이면 DB를 조회하지 않는다.
 */
export default async function MyPage() {
  const session = await getSession();
  const user = session
    ? await db.query.users.findFirst({
        where: eq(users.id, session.userId),
        // 허브에는 요약만 보여준다. 아이디·PIN 해시 등은 가져오지 않는다.
        columns: { nickname: true, department: true, bio: true, profileImageUrl: true },
      })
    : null;

  return (
    <div className="pb-8">
      <TopBar title="MY" />

      {user ? (
        <section className="flex items-center gap-4 pb-6">
          <Avatar src={user.profileImageUrl} name={user.nickname} size={64} />
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight truncate">{user.nickname}</h2>
            {user.department && <p className="text-sm text-muted-foreground">{user.department}</p>}
            {user.bio && <p className="text-sm mt-1 line-clamp-2">{user.bio}</p>}
          </div>
        </section>
      ) : (
        <section className="pb-8 text-center space-y-4">
          <p className="text-muted-foreground text-[15px]">로그인하면 글쓰기·댓글·회원 명부를 이용할 수 있어요.</p>
          <Link
            href={`/login?redirect=${encodeURIComponent('/my')}`}
            className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-foreground text-background font-semibold"
          >
            로그인
          </Link>
        </section>
      )}

      {user && (
        <MenuGroup title="계정">
          <MenuLink href="/mypage" icon={PencilIcon}>프로필 편집</MenuLink>
          {/* 표시 여부만 세션으로 정한다. 관리자 화면·액션은 서버에서 DB로 권한을 다시 확인한다. */}
          {session?.isAdmin && <MenuLink href="/admin/members" icon={ShieldIcon}>회원 관리</MenuLink>}
        </MenuGroup>
      )}

      <MenuGroup title="동호회 안내">
        <MenuLink href="/about/rules" icon={BookIcon}>회칙</MenuLink>
        <MenuLink href="/about/shared-cabinet" icon={BoxIcon}>공용 보관함 안내</MenuLink>
      </MenuGroup>

      {user && (
        <form action={logout} className="mt-6">
          <button
            type="submit"
            className="w-full h-12 flex items-center gap-3 px-4 rounded-2xl bg-muted/60 text-[15px] text-red-600 font-medium"
          >
            <LogoutIcon size={20} />
            로그아웃
          </button>
        </form>
      )}
    </div>
  );
}

function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="px-1 pb-2 text-xs font-semibold text-muted-foreground">{title}</h3>
      <ul className="rounded-2xl bg-muted/60 divide-y divide-border overflow-hidden">{children}</ul>
    </section>
  );
}

function MenuLink({ href, icon: Icon, children }: { href: string; icon: ComponentType<{ size?: number }>; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className="h-12 flex items-center gap-3 px-4 text-[15px] active:bg-muted">
        <Icon size={20} />
        <span className="flex-1">{children}</span>
        <ChevronRightIcon size={18} className="text-muted-foreground" />
      </Link>
    </li>
  );
}

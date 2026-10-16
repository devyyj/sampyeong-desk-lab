import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '../../../drizzle/schema';
import { getSession } from '@/lib/session';
import { logout } from '@/app/actions/auth';
import TopBar from '@/components/TopBar';
import Avatar from '@/components/Avatar';
import { BookIcon, BoxIcon, ChevronRightIcon, CodeIcon, LogoutIcon, PencilIcon, ShieldIcon } from '@/components/icons';

/** 이 앱의 소스 저장소. 동호회 회원이 기능을 제안하거나 코드를 살펴볼 수 있게 MY에서 소개한다. */
const REPO_URL = 'https://github.com/devyyj/sampyeong-desk-lab';

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
          {/* 계정은 관리자가 발급한다(자가 가입 없음). 처음 온 사람이 어디에 물어야 할지 알 수 있게 안내한다. */}
          <p className="text-[13px] text-muted-foreground">회원 가입은 관리자(youngyong.jo)에게 Teams로 문의해주세요.</p>
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

      <MenuGroup title="앱 정보">
        <li>
          {/* 외부 사이트라 새 창으로 연다(앱 화면을 떠나지 않게). */}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 text-[15px] active:bg-muted">
            <CodeIcon size={20} />
            <span className="flex-1 min-w-0">
              <span className="block">GitHub 저장소</span>
              <span className="block text-[13px] text-muted-foreground">이 앱의 소스 코드예요. 기능 제안·버그 제보도 환영해요.</span>
            </span>
            <ChevronRightIcon size={18} className="text-muted-foreground" />
          </a>
        </li>
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

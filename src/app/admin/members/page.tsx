import { notFound } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '../../../../drizzle/schema';
import { getAdminUser } from '@/lib/admin';
import { ResetPinForm } from './AdminMemberForms';
import TopBar from '@/components/TopBar';

export const dynamic = 'force-dynamic';

const statusOf = (u: { isAdmin: boolean; mustChangePin: boolean }) =>
  u.isAdmin ? '관리자' : u.mustChangePin ? '초기 PIN' : '정상';

export default async function AdminMembersPage() {
  // 관리자 화면의 존재 자체를 숨기기 위해 403 대신 404를 반환한다. 권한은 세션이 아닌 DB로 확인한다.
  if (!(await getAdminUser())) notFound();

  const members = await db.query.users.findMany({ orderBy: [asc(users.username)] });

  return (
    <div>
      {/* 회원 추가는 회원 탭과 같은 오른쪽 아래 ＋ 버튼(Fab, 관리자에게만)으로 통일했다. */}
      <TopBar title="회원 관리" backHref="/my" backLabel="MY로 돌아가기" />
      <p className="text-[13px] text-muted-foreground">
        계정 발급과 비밀번호 초기화는 관리자만 할 수 있습니다. 새 회원은 오른쪽 아래 ＋로 만듭니다.
      </p>

      {/* 표는 열이 많아 모바일에서 가로 스크롤이 생기므로, 회원 명부처럼 한 사람씩 세로로 쌓는다. */}
      <ul className="mt-2 divide-y divide-border">
        {members.map((m) => {
          const status = statusOf(m);
          const details = [m.nickname && m.nickname !== m.username && `닉네임 ${m.nickname}`, m.displayName, m.department].filter(Boolean).join(' · ');
          return (
            <li key={m.id} className="py-3.5 space-y-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-[15px] truncate">{m.username}</span>
                <span
                  className={`shrink-0 px-1.5 py-px rounded-md text-[11px] font-bold ${
                    status === '관리자' ? 'bg-foreground text-background' : status === '초기 PIN' ? 'bg-muted text-foreground border border-border' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {status}
                </span>
              </div>
              {details && <p className="text-[13px] text-muted-foreground break-words">{details}</p>}
              <ResetPinForm userId={m.id} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { notFound } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '../../../../drizzle/schema';
import { getAdminUser } from '@/lib/admin';
import { ResetPinForm } from './AdminMemberForms';
import TopBar, { TopBarAction } from '@/components/TopBar';
import { PlusIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

const statusOf = (u: { isAdmin: boolean; mustChangePin: boolean }) =>
  u.isAdmin ? '관리자' : u.mustChangePin ? '초기 PIN' : '정상';

export default async function AdminMembersPage() {
  // 관리자 화면의 존재 자체를 숨기기 위해 403 대신 404를 반환한다. 권한은 세션이 아닌 DB로 확인한다.
  if (!(await getAdminUser())) notFound();

  const members = await db.query.users.findMany({ orderBy: [asc(users.username)] });

  return (
    <div>
      <TopBar
        title="회원 관리"
        backHref="/my"
        backLabel="MY로 돌아가기"
        actions={
          // 회원 생성은 회원 탭 ＋와 같은 폼 화면(/members/new)으로 통일했다.
          <TopBarAction href="/members/new" label="회원 추가">
            <PlusIcon size={24} />
          </TopBarAction>
        }
      />
      <p className="text-[13px] text-muted-foreground">
        계정 발급과 비밀번호 초기화는 관리자만 할 수 있습니다. 새 회원은 오른쪽 위 ＋(회원 탭의 ＋와 같은 화면)로 만듭니다.
      </p>

      {/* 관리용 표는 열이 많아 모바일에서는 가로로 밀어 본다. */}
      <section className="mt-4 -mx-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3">아이디</th>
              <th className="px-4 py-3">닉네임</th>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">부서</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">비밀번호</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{m.username}</td>
                <td className="px-4 py-3">{m.nickname}</td>
                <td className="px-4 py-3">{m.displayName}</td>
                <td className="px-4 py-3">{m.department}</td>
                <td className="px-4 py-3">{statusOf(m)}</td>
                <td className="px-4 py-3"><ResetPinForm userId={m.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

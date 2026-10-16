import { notFound } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '../../../../drizzle/schema';
import { getAdminUser } from '@/lib/admin';
import { CreateMemberForm, ResetPinForm } from './AdminMemberForms';

export const dynamic = 'force-dynamic';

const statusOf = (u: { isAdmin: boolean; mustChangePin: boolean }) =>
  u.isAdmin ? '관리자' : u.mustChangePin ? '초기 PIN' : '정상';

export default async function AdminMembersPage() {
  // 관리자 화면의 존재 자체를 숨기기 위해 403 대신 404를 반환한다. 권한은 세션이 아닌 DB로 확인한다.
  if (!(await getAdminUser())) notFound();

  const members = await db.query.users.findMany({ orderBy: [asc(users.username)] });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight">회원 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">계정 발급과 비밀번호 초기화는 관리자만 할 수 있습니다.</p>
      </div>

      <section className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
        <h2 className="font-semibold">새 회원 생성</h2>
        <CreateMemberForm />
      </section>

      <section className="bg-card border border-border rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="p-3">아이디</th>
              <th className="p-3">닉네임</th>
              <th className="p-3">이름</th>
              <th className="p-3">부서</th>
              <th className="p-3">상태</th>
              <th className="p-3">비밀번호</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{m.username}</td>
                <td className="p-3">{m.nickname}</td>
                <td className="p-3">{m.displayName}</td>
                <td className="p-3">{m.department}</td>
                <td className="p-3">{statusOf(m)}</td>
                <td className="p-3"><ResetPinForm userId={m.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

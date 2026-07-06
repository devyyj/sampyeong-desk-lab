import { db } from "@/db";
import { users } from "../../../drizzle/schema";
import { desc } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const allUsers = await db.query.users.findMany({
    orderBy: [desc(users.createdAt)],
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight">회원 목록</h1>
        <p className="text-sm text-muted-foreground mt-1">SDL에 가입된 동호회 회원들입니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allUsers.map((user) => (
          <div key={user.id} className="bg-card border border-border p-6 rounded-2xl flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden mb-4 border-4 border-background shadow-sm">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-muted-foreground">
                  {user.username[0].toUpperCase()}
                </span>
              )}
            </div>
            <h3 className="font-bold text-lg text-foreground">{user.username}</h3>
            <span className="inline-block px-3 py-1 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full mt-2">
              {user.department}
            </span>
            <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
              {user.bio || '자기소개가 없습니다.'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

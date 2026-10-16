import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { seasonMembers, seasons } from '../../../drizzle/schema';
import { resolveSeason } from '@/lib/seasons';
import SeasonTabs from '@/components/SeasonTabs';

export const dynamic = 'force-dynamic';

// 직책이 있는 회원을 위에 보여준다. 이관 데이터에는 '회장'만 있으므로 그 외 직책은 이름순과 같은 취급.
const ROLE_ORDER: Record<string, number> = { 회장: 0 };

/**
 * 시즌 회원 명부. 실명·부서가 나오므로 회원 전용이다(route-guard의 PROTECTED_PREFIXES에 /members 등록).
 * 예전 '가입자 전체 목록' 대신 시즌별 명부를 보여준다. 이관 계정은 모두 명부에 묶여 있어,
 * 예전처럼 pin_hash로 사전 등록 계정을 걸러낼 필요가 없다.
 */
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string | string[] }>;
}) {
  const { season: seasonParam } = await searchParams;
  const allSeasons = await db.query.seasons.findMany({ orderBy: [asc(seasons.id)] });
  const season = resolveSeason(seasonParam, allSeasons);

  if (!season) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader />
        <p className="text-center py-20 text-muted-foreground">등록된 시즌이 없습니다.</p>
      </div>
    );
  }

  const rows = await db.query.seasonMembers.findMany({
    where: eq(seasonMembers.seasonId, season.id),
    columns: { role: true },
    with: {
      // pin_hash 등 민감한 컬럼은 화면에 필요 없으므로 가져오지 않는다.
      user: {
        columns: {
          username: true, displayName: true, department: true, bio: true, profileImageUrl: true, mustChangePin: true,
        },
      },
    },
  });

  const nameOf = (u: { displayName: string | null; username: string }) => u.displayName || u.username;
  const members = [...rows].sort((a, b) => {
    const roleDiff = (ROLE_ORDER[a.role ?? ''] ?? 99) - (ROLE_ORDER[b.role ?? ''] ?? 99);
    return roleDiff !== 0 ? roleDiff : nameOf(a.user).localeCompare(nameOf(b.user), 'ko');
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader />
      <SeasonTabs basePath="/members" seasons={allSeasons} selectedId={season.id} />

      <h2 className="text-lg font-bold">
        {season.name} 회원 명부 ({members.length}명)
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map(({ role, user }) => (
          <div key={user.username} className="bg-card border border-border p-5 rounded-2xl flex items-start gap-4 shadow-sm">
            <div className="w-14 h-14 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-muted-foreground">{nameOf(user)[0].toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-bold text-foreground">{nameOf(user)}</h3>
                {role && (
                  <span className="px-2 py-0.5 bg-primary-100 text-primary-600 text-xs font-semibold rounded-full">{role}</span>
                )}
                {/* 관리자가 발급한 초기 PIN을 아직 바꾸지 않은 회원 = 한 번도 로그인해 PIN을 설정하지 않은 회원 */}
                {user.mustChangePin && (
                  <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-medium rounded-full border border-border">
                    미접속
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{user.username}</p>
              <p className="text-sm text-muted-foreground mt-1">{user.department}</p>
              {user.bio && <p className="text-sm mt-2 line-clamp-2">{user.bio}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="pb-4 border-b border-border">
      <h1 className="text-2xl font-bold tracking-tight">회원 명부</h1>
      <p className="text-sm text-muted-foreground mt-1">시즌별로 활동한 SDL 회원들입니다.</p>
    </div>
  );
}

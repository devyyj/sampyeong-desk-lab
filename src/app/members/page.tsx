import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { seasonMembers, seasons } from '../../../drizzle/schema';
import { resolveSeason } from '@/lib/seasons';
import SeasonSelect from '@/components/SeasonSelect';
import { getSession } from '@/lib/session';
import { getSeasonCounts } from '@/lib/member-badges';
import LevelBadge from '@/components/LevelBadge';

export const dynamic = 'force-dynamic';

// 직책이 있는 회원을 위에 보여준다. 이관 데이터에는 '회장'만 있으므로 그 외 직책은 이름순과 같은 취급.
const ROLE_ORDER: Record<string, number> = { 회장: 0 };

/**
 * 시즌 회원 명부. 실명·부서가 나오므로 회원에게만 명부를 보여준다.
 * 비회원을 로그인 화면으로 튕겨 내는 대신(route-guard에서 /members 제외) 이 페이지에서 로그인 안내를 보여준다.
 * 비회원일 때는 명부를 아예 조회하지 않아 HTML에 실명이 남지 않는다.
 * 예전 '가입자 전체 목록' 대신 시즌별 명부를 보여준다. 이관 계정은 모두 명부에 묶여 있어,
 * 예전처럼 pin_hash로 사전 등록 계정을 걸러낼 필요가 없다.
 */
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string | string[] }>;
}) {
  const { season: seasonParam } = await searchParams;

  const session = await getSession();
  if (!session) {
    // 로그인 후 보던 시즌 그대로 돌아오도록 현재 주소(?season= 포함)를 redirect로 넘긴다.
    const seasonQuery = typeof seasonParam === 'string' ? `?season=${seasonParam}` : '';
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader />
        <div className="mt-6 bg-card border border-border rounded-xl p-8 text-center space-y-3">
          <p className="text-muted-foreground">회원 명부는 로그인해야 확인할 수 있습니다.</p>
          <Link
            href={`/login?redirect=${encodeURIComponent(`/members${seasonQuery}`)}`}
            className="inline-block px-4 py-2 bg-foreground text-background rounded-full text-sm font-semibold hover:bg-foreground/90"
          >
            로그인
          </Link>
        </div>
      </div>
    );
  }

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
          // 아이디는 로그인에만 쓰므로 명부에도 싣지 않고 닉네임을 보여준다.
          id: true, nickname: true, displayName: true, department: true, bio: true, profileImageUrl: true, mustChangePin: true,
        },
      },
    },
  });

  // 이름 옆 레벨(Lv.N) 표시용. 명단 전체를 한 번에 센다(N+1 방지).
  const seasonCounts = await getSeasonCounts(rows.map((row) => row.user.id));

  // 실명이 없는 회원(이관 데이터 일부)은 닉네임으로 대신한다.
  const nameOf = (u: { displayName: string | null; nickname: string }) => u.displayName || u.nickname;
  const members = [...rows].sort((a, b) => {
    const roleDiff = (ROLE_ORDER[a.role ?? ''] ?? 99) - (ROLE_ORDER[b.role ?? ''] ?? 99);
    return roleDiff !== 0 ? roleDiff : nameOf(a.user).localeCompare(nameOf(b.user), 'ko');
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader />
      <SeasonSelect basePath="/members" seasons={allSeasons} selectedId={season.id} />

      <h2 className="text-lg font-bold">
        {season.name} 회원 명부 ({members.length}명)
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map(({ role, user }) => (
          <div key={user.id} className="bg-card border border-border p-5 rounded-2xl flex items-start gap-4 shadow-sm">
            <div className="w-14 h-14 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-muted-foreground">{nameOf(user)[0].toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <h3 className="font-bold text-foreground">{nameOf(user)}</h3>
                {/* 실명 옆에 게시글·댓글에서 쓰는 닉네임을 함께 보여준다. 실명이 없으면 이름 자리에 이미 닉네임이 있다. */}
                {user.displayName && <span className="text-sm text-muted-foreground">{user.nickname}</span>}
                {/*
                  게시글·댓글의 닉네임 배지와 같은 모양. 회장은 참여 수 대신 회장으로만 표시하는데, 명부는 시즌별이라
                  최신 시즌 기준(getMemberBadges)이 아니라 고른 시즌의 직책을 따른다.
                */}
                {role === '회장' ? (
                  <LevelBadge badge={{ kind: 'president' }} />
                ) : (
                  (seasonCounts.get(user.id) ?? 0) > 0 && <LevelBadge badge={{ kind: 'seasons', count: seasonCounts.get(user.id)! }} />
                )}
                {/* 회장 외 직책(이관 데이터에는 없음)이 생기면 기존처럼 칩으로 보여준다. */}
                {role && role !== '회장' && (
                  <span className="px-2 py-0.5 bg-primary-100 text-primary-600 text-xs font-semibold rounded-full">{role}</span>
                )}
                {/* 관리자가 발급한 초기 PIN을 아직 바꾸지 않은 회원 = 한 번도 로그인해 PIN을 설정하지 않은 회원 */}
                {user.mustChangePin && (
                  <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-medium rounded-full border border-border">
                    미접속
                  </span>
                )}
              </div>
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

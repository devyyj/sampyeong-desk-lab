import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { seasonMembers, seasons } from '../../../../drizzle/schema';
import { resolveSeason } from '@/lib/seasons';
import ScreenTitle from '@/components/ScreenTitle';
import Avatar from '@/components/Avatar';
import EmptyState, { primaryButtonClass } from '@/components/EmptyState';
import { chipClass } from '@/lib/chip';
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
      <div>
        <ScreenTitle title="회원 명부" />
        <EmptyState
          title="회원 명부는 로그인해야 확인할 수 있습니다."
          description="실명·부서가 있어 회원에게만 보여드려요."
          action={
            <Link href={`/login?redirect=${encodeURIComponent(`/members${seasonQuery}`)}`} className={primaryButtonClass}>
              로그인
            </Link>
          }
        />
      </div>
    );
  }

  const allSeasons = await db.query.seasons.findMany({ orderBy: [asc(seasons.id)] });
  const season = resolveSeason(seasonParam, allSeasons);

  if (!season) {
    return (
      <div>
        <ScreenTitle title="회원 명부" />
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
  // 정렬: 회장(직책) → 레벨(참여 시즌 수) 높은 순 → 이름 가나다순.
  // 회장은 레벨 대신 회장으로 표시하므로 레벨과 상관없이 맨 위에 둔다.
  const levelOf = (userId: string) => seasonCounts.get(userId) ?? 0;
  const members = [...rows].sort((a, b) => {
    const roleDiff = (ROLE_ORDER[a.role ?? ''] ?? 99) - (ROLE_ORDER[b.role ?? ''] ?? 99);
    return roleDiff || levelOf(b.user.id) - levelOf(a.user.id) || nameOf(a.user).localeCompare(nameOf(b.user), 'ko');
  });
  // 시즌 칩은 최근 시즌부터(가장 많이 보는 시즌이 왼쪽 처음에 오게).
  const seasonChips = [...allSeasons].sort((x, y) => y.id - x.id);

  return (
    <div>
      <ScreenTitle title="회원 명부" />

      {/* 시즌 선택은 ?season= 쿼리 링크라 공유·뒤로 가기가 그대로 된다. 넘치면 가로로 밀어 본다. */}
      <nav aria-label="시즌 선택" className="-mx-4 px-4 flex gap-2 overflow-x-auto no-scrollbar">
        {seasonChips.map((s) => (
          <Link key={s.id} href={`/members?season=${s.id}`} aria-current={s.id === season.id ? 'page' : undefined} className={chipClass(s.id === season.id)}>
            {s.name}
          </Link>
        ))}
      </nav>

      <div className="mt-4 flex items-baseline gap-2">
        <h2 className="text-[18px] font-bold">
          {season.name} 회원 명부 ({members.length}명)
        </h2>
        <span className="text-[14px] text-muted-foreground">{season.period}</span>
      </div>


      <ul className="mt-2 divide-y divide-border">
        {members.map(({ role, user }) => (
          <li key={user.id} className="py-3.5 flex items-start gap-3">
            <Avatar src={user.profileImageUrl} name={nameOf(user)} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <h3 className="text-[17px] font-bold text-foreground">{nameOf(user)}</h3>
                {/* 실명 옆에 게시글·댓글에서 쓰는 닉네임을 함께 보여준다. 실명이 없으면 이름 자리에 이미 닉네임이 있다. */}
                {user.displayName && <span className="text-sm text-muted-foreground">{user.nickname}</span>}
                {/*
                  게시글·댓글의 닉네임 배지와 같은 모양. 회장은 레벨 대신 회장으로만 표시하는데, 명부는 시즌별이라
                  최신 시즌 기준(getMemberBadges)이 아니라 고른 시즌의 직책을 따른다.
                */}
                {role === '회장' ? (
                  <LevelBadge badge={{ kind: 'president' }} />
                ) : (
                  levelOf(user.id) > 0 && <LevelBadge badge={{ kind: 'seasons', count: levelOf(user.id) }} />
                )}
                {/* 회장 외 직책(이관 데이터에는 없음)이 생기면 칩으로 보여준다. */}
                {role && role !== '회장' && (
                  <span className="px-1.5 py-px rounded-md text-[12px] font-bold bg-muted text-foreground">{role}</span>
                )}
                {/* 관리자가 발급한 초기 PIN을 아직 바꾸지 않은 회원 = 한 번도 로그인해 PIN을 설정하지 않은 회원 */}
                {user.mustChangePin && (
                  <span className="px-1.5 py-px rounded-md text-[12px] font-medium text-muted-foreground border border-border">미접속</span>
                )}
              </div>
              {user.department && <p className="text-[14px] text-muted-foreground mt-0.5">{user.department}</p>}
              {user.bio && <p className="text-[15px] mt-1 line-clamp-2">{user.bio}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

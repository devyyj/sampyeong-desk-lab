import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/db';
import { getSession } from '@/lib/session';
import { getMemberBadges } from '@/lib/member-badges';
import { getProfile } from './profile';

vi.mock('@/db', () => ({ db: { query: { users: { findFirst: vi.fn() } } } }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/member-badges', () => ({ getMemberBadges: vi.fn() }));

const UID = '5051697b-7014-408c-9159-d9c23df77b19';
const row = {
  id: UID, username: 'kim.ace', nickname: '보드왕', displayName: '김철수', department: '개발팀',
  profileImageUrl: 'https://x/avatar.png', bio: '안녕하세요', pinHash: 'secret', isAdmin: false,
};

describe('getProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.query.users.findFirst).mockResolvedValue(row as never);
    vi.mocked(getMemberBadges).mockResolvedValue(new Map([[UID, { kind: 'president' as const }]]));
  });

  it('회원이 보면 실명·부서까지 돌려준다(아이디·PIN 해시 같은 내부 값은 없음)', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'viewer', username: 'v', isAdmin: false, mustChangePin: false, expiresAt: new Date() });
    expect(await getProfile(UID)).toEqual({
      nickname: '보드왕', profileImageUrl: 'https://x/avatar.png', bio: '안녕하세요',
      badge: { kind: 'president' }, displayName: '김철수', department: '개발팀',
    });
  });

  it('비회원이 보면 실명·부서 키 자체가 없다', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const profile = await getProfile(UID);
    expect(profile).toEqual({ nickname: '보드왕', profileImageUrl: 'https://x/avatar.png', bio: '안녕하세요', badge: { kind: 'president' } });
    expect(profile).not.toHaveProperty('displayName');
    expect(profile).not.toHaveProperty('department');
  });

  it('배지가 없으면 null, 없는 회원·잘못된 id면 null(잘못된 id는 DB를 조회하지 않음)', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(getMemberBadges).mockResolvedValueOnce(new Map());
    expect(await getProfile(UID)).toMatchObject({ badge: null });
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined as never);
    expect(await getProfile(UID)).toBeNull();
    vi.mocked(db.query.users.findFirst).mockClear();
    expect(await getProfile('not-a-uuid')).toBeNull();
    expect(db.query.users.findFirst).not.toHaveBeenCalled();
  });
});

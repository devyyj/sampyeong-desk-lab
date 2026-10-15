// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { getAdminUser } from './admin';
import { db } from '@/db';
import * as session from '@/lib/session';

vi.mock('@/db', () => ({
  db: { select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(), where: vi.fn() },
}));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));

const mockDb = db as unknown as Record<'select' | 'from' | 'where', Mock>;
const sessionOf = (isAdmin: boolean) =>
  vi.mocked(session.getSession).mockResolvedValueOnce({ userId: 'u1', username: 'admin', isAdmin, mustChangePin: false, expiresAt: new Date() });

describe('getAdminUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('세션이 없으면 null (DB 조회 안 함)', async () => {
    vi.mocked(session.getSession).mockResolvedValueOnce(null);
    expect(await getAdminUser()).toBeNull();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('세션은 관리자라도 DB에서 관리자가 해제됐으면 null', async () => {
    sessionOf(true);
    mockDb.where.mockResolvedValueOnce([{ id: 'u1', username: 'admin', isAdmin: false }]);
    expect(await getAdminUser()).toBeNull();
  });

  it('DB에서 관리자면 사용자 반환 (세션 값과 무관)', async () => {
    sessionOf(false);
    mockDb.where.mockResolvedValueOnce([{ id: 'u1', username: 'admin', isAdmin: true }]);
    expect(await getAdminUser()).toMatchObject({ id: 'u1', isAdmin: true });
  });

  it('세션의 사용자가 DB에 없으면 null', async () => {
    sessionOf(true);
    mockDb.where.mockResolvedValueOnce([]);
    expect(await getAdminUser()).toBeNull();
  });
});

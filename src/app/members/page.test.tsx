import { describe, it, expect, vi } from 'vitest';
import { isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '../../../drizzle/schema';
import MembersPage from './page';

vi.mock('@/db', () => ({
  db: { query: { users: { findMany: vi.fn().mockResolvedValue([]) } } },
}));

describe('MembersPage', () => {
  it('사전 등록(미가입, pin_hash NULL) 계정은 목록 조회에서 제외', async () => {
    await MembersPage();

    const args = vi.mocked(db.query.users.findMany).mock.calls[0][0]!;
    expect(args.where).toEqual(isNotNull(users.pinHash));
  });
});

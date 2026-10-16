import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';
import AdminMembersPage from './page';

vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn() }));
vi.mock('@/app/actions/admin', () => ({ createMember: vi.fn(), resetMemberPin: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
vi.mock('@/db', () => ({
  db: {
    query: {
      users: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'a', username: 'admin.user', displayName: '관리자님', department: '운영', isAdmin: true, mustChangePin: false },
          { id: 'b', username: 'kim.test', nickname: '김닉', displayName: '김테스트', department: '개발팀', isAdmin: false, mustChangePin: true },
          { id: 'c', username: 'lee.test', displayName: '이테스트', department: '인사팀', isAdmin: false, mustChangePin: false },
        ]),
      },
    },
  },
}));

describe('AdminMembersPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('관리자가 아니면 notFound()', async () => {
    vi.mocked(getAdminUser).mockResolvedValueOnce(null);
    await expect(AdminMembersPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('관리자면 회원 생성 폼과 회원별 상태(관리자/초기 PIN/정상)를 표시', async () => {
    vi.mocked(getAdminUser).mockResolvedValueOnce({ id: 'a', isAdmin: true } as never);
    render(await AdminMembersPage());

    expect(screen.getByRole('button', { name: '회원 생성' })).toBeInTheDocument();
    const rowOf = (username: string) => screen.getByText(username).closest('tr')!;
    expect(within(rowOf('admin.user')).getByText('관리자')).toBeInTheDocument();
    expect(within(rowOf('kim.test')).getByText('초기 PIN')).toBeInTheDocument();
    expect(within(rowOf('lee.test')).getByText('정상')).toBeInTheDocument();
    expect(within(rowOf('kim.test')).getByRole('button', { name: 'PIN 초기화' })).toBeInTheDocument();
    // 관리용이라 아이디를 유지하고 닉네임 열을 함께 보여준다.
    expect(screen.getByRole('columnheader', { name: '닉네임' })).toBeInTheDocument();
    expect(within(rowOf('kim.test')).getByText('김닉')).toBeInTheDocument();
  });
});

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
          { id: 'a', username: 'admin.user', displayName: '관리자님', department: '운영', isAdmin: true, mustChangePin: false, seasonMemberships: [] },
          { id: 'b', username: 'kim.test', nickname: '김닉', displayName: '김테스트', department: '개발팀', isAdmin: false, mustChangePin: true, seasonMemberships: [{ seasonId: 3 }, { seasonId: 2 }] },
          { id: 'c', username: 'lee.test', displayName: '이테스트', department: '인사팀', isAdmin: false, mustChangePin: false, seasonMemberships: [{ seasonId: 1 }, { seasonId: 4 }] },
          { id: 'd', username: 'aaa.test', displayName: '에이', department: '인사팀', isAdmin: false, mustChangePin: false, seasonMemberships: [{ seasonId: 2 }] },
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

  it('관리자면 회원마다 아이디·상태(관리자/초기 PIN/정상)·닉네임·이름·부서·PIN 초기화를 목록으로 보여준다(표 없음)', async () => {
    vi.mocked(getAdminUser).mockResolvedValueOnce({ id: 'a', isAdmin: true } as never);
    render(await AdminMembersPage());

    // 모바일에서 가로 스크롤이 생기지 않도록 표 대신 목록으로 쌓는다.
    expect(screen.queryByRole('table')).toBeNull();
    const rowOf = (username: string) => screen.getByText(username).closest('li')!;
    expect(within(rowOf('admin.user')).getByText('관리자')).toBeInTheDocument();
    expect(within(rowOf('kim.test')).getByText('초기 PIN')).toBeInTheDocument();
    expect(within(rowOf('lee.test')).getByText('정상')).toBeInTheDocument();
    expect(within(rowOf('kim.test')).getByRole('button', { name: 'PIN 초기화' })).toBeInTheDocument();
    // 관리용이라 아이디를 유지하고 닉네임·이름·부서를 함께 보여준다.
    expect(rowOf('kim.test')).toHaveTextContent('김닉');
    expect(rowOf('kim.test')).toHaveTextContent('김테스트');
    expect(rowOf('kim.test')).toHaveTextContent('개발팀');
  });

  it('회원 추가는 다른 화면과 같은 ＋ 버튼(Fab)으로 하고, 페이지에는 따로 두지 않는다', async () => {
    vi.mocked(getAdminUser).mockResolvedValueOnce({ id: 'a', isAdmin: true } as never);
    render(await AdminMembersPage());
    expect(screen.queryByRole('link', { name: '회원 추가' })).toBeNull();
  });

  it('시즌 순서대로: 처음 참여한 시즌이 빠른 회원부터(같으면 아이디순), 시즌이 없는 계정은 맨 뒤', async () => {
    vi.mocked(getAdminUser).mockResolvedValueOnce({ id: 'a', isAdmin: true } as never);
    render(await AdminMembersPage());
    const order = screen.getAllByRole('listitem').map((li) => li.querySelector('span')!.textContent);
    expect(order).toEqual(['lee.test', 'aaa.test', 'kim.test', 'admin.user']);
  });

  it('회원마다 참여 시즌을 순서대로 보여준다', async () => {
    vi.mocked(getAdminUser).mockResolvedValueOnce({ id: 'a', isAdmin: true } as never);
    render(await AdminMembersPage());
    const rowOf = (username: string) => screen.getByText(username).closest('li')!;
    expect(rowOf('kim.test')).toHaveTextContent('시즌 2, 3');
    expect(rowOf('lee.test')).toHaveTextContent('시즌 1, 4');
    expect(rowOf('admin.user')).toHaveTextContent('시즌 없음');
  });
});

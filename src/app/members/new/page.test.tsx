import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';
import NewMemberPage from './page';

vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn() }));
vi.mock('@/app/actions/admin', () => ({ createMember: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));

describe('NewMemberPage (/members/new)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('관리자가 아니면 notFound(화면 존재 자체를 숨김)', async () => {
    vi.mocked(getAdminUser).mockResolvedValueOnce(null);
    await expect(NewMemberPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('관리자에게는 게시글·보드게임과 같은 폼 화면(취소 | 회원 추가 | 회원 생성)', async () => {
    vi.mocked(getAdminUser).mockResolvedValueOnce({ id: 'a', isAdmin: true } as never);
    render(await NewMemberPage());
    expect(screen.getByRole('heading', { name: '회원 추가' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '취소' })).toHaveAttribute('href', '/members');
    expect(screen.getByRole('button', { name: '회원 생성' })).toBeInTheDocument();
    for (const label of ['아이디 (사내 ID)', '이름', '소속 부서(팀)', '초기 PIN']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});

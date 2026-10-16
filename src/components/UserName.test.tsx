import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import UserName from './UserName';
import { getProfile } from '@/app/actions/profile';

vi.mock('@/app/actions/profile', () => ({ getProfile: vi.fn() }));

const UID = '5051697b-7014-408c-9159-d9c23df77b19';

describe('UserName', () => {
  beforeEach(() => vi.clearAllMocks());

  it('닉네임과 배지만 보여주고, 누르기 전에는 프로필을 조회하지 않는다', () => {
    render(<UserName userId={UID} nickname="보드왕" badge={{ kind: 'seasons', count: 3 }} />);
    expect(screen.getByRole('button', { name: '보드왕 [3시즌]' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(getProfile).not.toHaveBeenCalled();
  });

  it('최신 시즌 회장은 [회장], 배지가 없으면 닉네임만', () => {
    const { rerender } = render(<UserName userId={UID} nickname="회장님" badge={{ kind: 'president' }} />);
    expect(screen.getByRole('button', { name: '회장님 [회장]' })).toBeInTheDocument();
    rerender(<UserName userId={UID} nickname="새내기" badge={null} />);
    expect(screen.getByRole('button', { name: '새내기' })).toBeInTheDocument();
  });

  it('누르면 프로필 팝업을 열어 서버에서 받은 내용을 보여주고, 닫기·ESC·배경 클릭으로 닫는다', async () => {
    vi.mocked(getProfile).mockResolvedValue({
      nickname: '보드왕', profileImageUrl: 'https://x/a.png', bio: '안녕하세요',
      badge: { kind: 'president' }, displayName: '김철수', department: '개발팀',
    });
    render(<UserName userId={UID} nickname="보드왕" badge={{ kind: 'president' }} />);
    const open = () => fireEvent.click(screen.getByRole('button', { name: '보드왕 [회장]' }));

    open();
    const dialog = await screen.findByRole('dialog', { name: '보드왕 프로필' });
    expect(getProfile).toHaveBeenCalledWith(UID);
    expect(await within(dialog).findByText('김철수')).toBeInTheDocument();
    expect(within(dialog).getByText('개발팀')).toBeInTheDocument();
    expect(within(dialog).getByText('안녕하세요')).toBeInTheDocument();
    expect(within(dialog).getByText('회장')).toBeInTheDocument();
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'https://x/a.png');

    fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    open();
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    open();
    const again = await screen.findByRole('dialog');
    // 시트 안쪽을 누르면 닫히지 않고, 배경(오버레이)을 눌러야 닫힌다. (h2는 시트 제목 "보드왕 프로필")
    fireEvent.click(within(again).getByText('보드왕', { selector: 'p' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(again);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('비회원 응답(실명·부서 없음)이면 그 항목을 그리지 않는다', async () => {
    vi.mocked(getProfile).mockResolvedValue({ nickname: '보드왕', profileImageUrl: null, bio: null, badge: { kind: 'seasons', count: 2 } });
    render(<UserName userId={UID} nickname="보드왕" badge={{ kind: 'seasons', count: 2 }} />);
    fireEvent.click(screen.getByRole('button'));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('2시즌 참여')).toBeInTheDocument();
    expect(within(dialog).queryByText('실명')).toBeNull();
    expect(within(dialog).queryByText('부서')).toBeNull();
  });

  it('프로필을 못 가져오면 안내 문구', async () => {
    vi.mocked(getProfile).mockResolvedValue(null);
    render(<UserName userId={UID} nickname="탈퇴회원" badge={null} />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('프로필을 불러오지 못했습니다.')).toBeInTheDocument();
  });
});

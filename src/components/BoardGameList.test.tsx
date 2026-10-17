import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import BoardGameList, { type BoardGameItem } from './BoardGameList';
import { deleteBoardGame } from '@/app/actions/boardgame';

vi.mock('@/app/actions/boardgame', () => ({ deleteBoardGame: vi.fn() }));
vi.mock('@/app/actions/reactions', () => ({ setLike: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const game = (id: string, name: string): BoardGameItem => ({
  id, name, category: '전략', recommendedPlayers: null, playTime: null, inSharedCabinet: false,
  thumbnailUrl: null, ownerName: null, likeCount: 0, liked: false,
});

describe('BoardGameList', () => {
  it('삭제가 끝나면 서버가 화면을 다시 그려 주기를 기다리지 않고 목록에서 바로 뺀다', async () => {
    vi.mocked(deleteBoardGame).mockResolvedValue(undefined);
    // props(games)는 그대로 둔다: 탭 화면의 loading 경계 안에서는 router.refresh()가 목록을 바꿔 주지 못하는 경우가 있었다.
    render(<BoardGameList games={[game('g1', '스컬킹'), game('g2', '아그리콜라')]} canEdit />);

    fireEvent.click(screen.getByRole('button', { name: '스컬킹 상세 보기' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: '스컬킹 상세 보기' })).toBeNull());
    expect(deleteBoardGame).toHaveBeenCalledWith('g1');
    expect(screen.getByRole('button', { name: '아그리콜라 상세 보기' })).toBeInTheDocument();
  });
});

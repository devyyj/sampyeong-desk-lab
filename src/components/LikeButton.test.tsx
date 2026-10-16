import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import LikeButton from './LikeButton';
import { toggleLike } from '@/app/actions/reactions';

vi.mock('@/app/actions/reactions', () => ({ toggleLike: vi.fn() }));

const ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('LikeButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('누르면 서버 응답 전에 바로 반영하고(낙관적), 응답으로 확정한다', async () => {
    let resolve!: (v: { liked: boolean; count: number }) => void;
    vi.mocked(toggleLike).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render(<LikeButton target="post" id={ID} liked={false} count={2} canLike />);
    const button = screen.getByRole('button', { name: '좋아요 2' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(await screen.findByRole('button', { name: '좋아요 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(toggleLike).toHaveBeenCalledWith('post', ID);

    // 그 사이 다른 회원도 눌러 서버 개수가 더 크면 서버 값으로 확정한다.
    await act(async () => resolve({ liked: true, count: 5 }));
    expect(screen.getByRole('button', { name: '좋아요 5' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('이미 누른 상태에서 누르면 취소된다', async () => {
    vi.mocked(toggleLike).mockResolvedValueOnce({ liked: false, count: 0 });
    render(<LikeButton target="comment" id={ID} liked count={1} canLike />);
    fireEvent.click(screen.getByRole('button', { name: '좋아요 1' }));
    expect(await screen.findByRole('button', { name: '좋아요 0' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('실패하면 원래 상태로 되돌리고 오류를 보여준다', async () => {
    vi.mocked(toggleLike).mockResolvedValueOnce({ error: '찾을 수 없습니다.' });
    render(<LikeButton target="activity" id={ID} liked={false} count={2} canLike />);
    fireEvent.click(screen.getByRole('button', { name: '좋아요 2' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('찾을 수 없습니다.');
    await waitFor(() => expect(screen.getByRole('button', { name: '좋아요 2' })).toHaveAttribute('aria-pressed', 'false'));
  });

  it('비회원은 수만 보이고, 누르면 로그인 안내만 한다(서버 호출·숫자 변화 없음)', () => {
    render(<LikeButton target="post" id={ID} liked={false} count={4} canLike={false} />);
    fireEvent.click(screen.getByRole('button', { name: '좋아요 4' }));
    expect(screen.getByRole('button', { name: '좋아요 4' })).toHaveAttribute('aria-pressed', 'false');
    expect(toggleLike).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('로그인하면 좋아요를 누를 수 있습니다.');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import LikeButton from './LikeButton';
import { setLike } from '@/app/actions/reactions';

vi.mock('@/app/actions/reactions', () => ({ setLike: vi.fn() }));

const ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
type Result = { liked: boolean; count: number } | { error: string };

/** 응답을 테스트가 원하는 때에 돌려주도록 대기 중인 호출을 모아 둔다. */
function deferredCalls() {
  const pending: ((v: Result) => void)[] = [];
  vi.mocked(setLike).mockImplementation(() => new Promise<Result>((r) => pending.push(r)));
  return pending;
}

describe('LikeButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('누르면 서버 응답 전에 바로 반영하고(낙관적), 응답으로 확정한다', async () => {
    const pending = deferredCalls();
    render(<LikeButton target="post" id={ID} liked={false} count={2} canLike />);
    const button = screen.getByRole('button', { name: '좋아요 2' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(screen.getByRole('button', { name: '좋아요 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(setLike).toHaveBeenCalledWith('post', ID, true);

    // 그 사이 다른 회원도 눌러 서버 개수가 더 크면 서버 값으로 확정한다.
    await act(async () => pending[0]({ liked: true, count: 5 }));
    expect(screen.getByRole('button', { name: '좋아요 5' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('이미 누른 상태에서 누르면 취소된다', async () => {
    vi.mocked(setLike).mockResolvedValueOnce({ liked: false, count: 0 });
    render(<LikeButton target="comment" id={ID} liked count={1} canLike />);
    fireEvent.click(screen.getByRole('button', { name: '좋아요 1' }));
    expect(setLike).toHaveBeenCalledWith('comment', ID, false);
    expect(await screen.findByRole('button', { name: '좋아요 0' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('응답을 기다리는 중에도 연달아 누르면 바로 반영되고, 마지막으로 누른 상태로 서버를 맞춘다', async () => {
    const pending = deferredCalls();
    render(<LikeButton target="post" id={ID} liked={false} count={2} canLike />);

    // 좋아요 → (응답 전) 해제 → (응답 전) 다시 좋아요
    fireEvent.click(screen.getByRole('button', { name: '좋아요 2' }));
    fireEvent.click(screen.getByRole('button', { name: '좋아요 3' }));
    expect(screen.getByRole('button', { name: '좋아요 2' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: '좋아요 2' }));
    expect(screen.getByRole('button', { name: '좋아요 3' })).toHaveAttribute('aria-pressed', 'true');

    // 요청은 한 번에 하나만 보낸다(순서가 뒤바뀌어 엉뚱한 상태로 끝나지 않게).
    expect(setLike).toHaveBeenCalledTimes(1);
    await act(async () => pending[0]({ liked: true, count: 3 }));
    // 첫 요청(true)과 마지막 의도(true)가 같으니 더 보내지 않는다.
    expect(setLike).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '좋아요 3' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('응답 전에 해제하면 첫 응답 뒤 해제 요청을 이어서 보내고 그 결과로 확정한다', async () => {
    const pending = deferredCalls();
    render(<LikeButton target="post" id={ID} liked={false} count={2} canLike />);
    fireEvent.click(screen.getByRole('button', { name: '좋아요 2' }));
    fireEvent.click(screen.getByRole('button', { name: '좋아요 3' }));

    // 첫 응답이 와도 화면은 사용자가 마지막으로 누른 상태(해제)를 유지한다.
    await act(async () => pending[0]({ liked: true, count: 3 }));
    expect(screen.getByRole('button', { name: '좋아요 2' })).toHaveAttribute('aria-pressed', 'false');
    expect(setLike).toHaveBeenCalledTimes(2);
    expect(setLike).toHaveBeenLastCalledWith('post', ID, false);

    await act(async () => pending[1]({ liked: false, count: 2 }));
    expect(screen.getByRole('button', { name: '좋아요 2' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('실패하면 마지막으로 확정된 상태로 되돌리고 오류를 보여준다', async () => {
    vi.mocked(setLike).mockResolvedValueOnce({ error: '찾을 수 없습니다.' });
    render(<LikeButton target="post" id={ID} liked={false} count={2} canLike />);
    fireEvent.click(screen.getByRole('button', { name: '좋아요 2' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('찾을 수 없습니다.');
    await waitFor(() => expect(screen.getByRole('button', { name: '좋아요 2' })).toHaveAttribute('aria-pressed', 'false'));
  });

  it('비회원은 수만 보이고, 누르면 로그인 안내만 한다(서버 호출·숫자 변화 없음)', () => {
    render(<LikeButton target="post" id={ID} liked={false} count={4} canLike={false} />);
    fireEvent.click(screen.getByRole('button', { name: '좋아요 4' }));
    expect(screen.getByRole('button', { name: '좋아요 4' })).toHaveAttribute('aria-pressed', 'false');
    expect(setLike).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('로그인하면 좋아요를 누를 수 있습니다.');
  });

  it('서버가 새 값을 내려주면(다시 그리기) 그 값을 따른다', () => {
    const { rerender } = render(<LikeButton target="post" id={ID} liked={false} count={2} canLike />);
    rerender(<LikeButton target="post" id={ID} liked count={7} canLike />);
    expect(screen.getByRole('button', { name: '좋아요 7' })).toHaveAttribute('aria-pressed', 'true');
  });
});

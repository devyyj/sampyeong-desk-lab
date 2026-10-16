import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { FeedItem } from '@/lib/feed';
import { loadFeedItem, loadMoreFeed } from '@/app/actions/feed';
import { addComment } from '@/app/actions/comments';
import { deletePost } from '@/app/actions/post';
import FeedList from './FeedList';

vi.mock('@/app/actions/feed', () => ({ loadMoreFeed: vi.fn(), loadFeedItem: vi.fn() }));
vi.mock('@/app/actions/profile', () => ({ getProfile: vi.fn() }));
vi.mock('@/app/actions/comments', () => ({ addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn() }));
vi.mock('@/app/actions/reactions', () => ({ toggleLike: vi.fn() }));
vi.mock('@/app/actions/post', () => ({ deletePost: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

// jsdom에는 IntersectionObserver가 없어 콜백을 잡아 두고 직접 호출한다.
let intersect: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
class FakeObserver {
  constructor(cb: typeof intersect) {
    intersect = cb;
  }
  observe() {}
  disconnect() {}
}

const item = (id: string, o: Partial<FeedItem> = {}): FeedItem => ({
  id,
  authorId: 'u1',
  author: { id: 'u1', nickname: '보드왕', profileImageUrl: null },
  badge: null,
  content: `글 ${id}`,
  createdAt: '2026-10-17T00:00:00.000Z',
  createdLabel: '방금',
  activity: null,
  images: [],
  photoCount: 0,
  photosLocked: false,
  likeCount: 0,
  liked: false,
  comments: [],
  canEdit: false,
  ...o,
});
const FILTER = { kind: 'activity' as const, type: null };

describe('FeedList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intersect = null;
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });

  it('첫 페이지를 그리고, 바닥에 닿으면 같은 필터로 다음 페이지를 이어 붙인다(겹친 글은 거름)', async () => {
    vi.mocked(loadMoreFeed).mockResolvedValueOnce({ items: [item('b'), item('c')], hasMore: false });
    render(<FeedList filter={FILTER} initial={{ items: [item('a'), item('b')], hasMore: true }} viewer={null} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    await act(async () => intersect?.([{ isIntersecting: true }]));
    expect(loadMoreFeed).toHaveBeenCalledWith(FILTER, 2);
    expect(screen.getAllByRole('article').map((a) => a.textContent)).toEqual([
      expect.stringContaining('글 a'),
      expect.stringContaining('글 b'),
      expect.stringContaining('글 c'),
    ]);
    expect(screen.getByText('모든 글을 불러왔어요')).toBeInTheDocument();
  });

  it('자동 로드가 실패하면 알리고 버튼으로 다시 시도한다', async () => {
    vi.mocked(loadMoreFeed).mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ items: [item('b')], hasMore: false });
    render(<FeedList filter={FILTER} initial={{ items: [item('a')], hasMore: true }} viewer={null} />);
    await act(async () => intersect?.([{ isIntersecting: true }]));
    expect(screen.getByRole('alert')).toHaveTextContent('글을 더 불러오지 못했어요');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '글 더 보기' })));
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('삭제한 글은 목록에서 바로 빠진다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    render(
      <FeedList
        filter={FILTER}
        initial={{ items: [item('a', { canEdit: true }), item('b')], hasMore: false }}
        viewer={{ id: 'u1', isAdmin: false }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '게시글 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('a'));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
  });

  it('댓글을 달면 그 카드만 서버에서 다시 받아 바꿔 끼운다(무한 스크롤 목록은 revalidate로 안 바뀜)', async () => {
    vi.mocked(addComment).mockResolvedValueOnce({ ok: true });
    const comment = {
      id: 'c1', authorId: 'u1', nickname: '보드왕', badge: null, content: '새 댓글', createdLabel: '2026. 10. 17. 12:00',
      edited: false, likeCount: 0, liked: false,
    };
    vi.mocked(loadFeedItem).mockResolvedValueOnce(item('a', { comments: [comment] }));
    render(<FeedList filter={FILTER} initial={{ items: [item('a'), item('b')], hasMore: false }} viewer={{ id: 'u1', isAdmin: false }} />);
    fireEvent.click(screen.getAllByRole('button', { name: '댓글 0' })[0]);
    fireEvent.change(screen.getByRole('textbox', { name: '댓글 쓰기' }), { target: { value: '새 댓글' } });
    fireEvent.click(screen.getByRole('button', { name: '댓글 달기' }));
    await waitFor(() => expect(loadFeedItem).toHaveBeenCalledWith('a'));
    expect(await screen.findByRole('button', { name: '댓글 1' })).toBeInTheDocument();
  });

  it('글이 없으면 빈 화면 안내', () => {
    render(<FeedList filter={FILTER} initial={{ items: [], hasMore: false }} viewer={null} />);
    expect(screen.getByText('아직 등록된 글이 없어요')).toBeInTheDocument();
  });
});

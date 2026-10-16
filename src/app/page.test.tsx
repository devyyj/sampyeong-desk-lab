import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { db } from '@/db';
import { getSession } from '@/lib/session';
import { getMemberBadges } from '@/lib/member-badges';
import { getComments, getLikeSummaries } from '@/lib/community';
import Page from './page';

vi.mock('@/db', () => ({ db: { query: { posts: { findMany: vi.fn() } } } }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/member-badges', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/member-badges')>()),
  getMemberBadges: vi.fn(),
}));
vi.mock('@/app/actions/profile', () => ({ getProfile: vi.fn() }));
vi.mock('@/lib/community', () => ({ getComments: vi.fn(), getLikeSummaries: vi.fn() }));
vi.mock('@/app/actions/comments', () => ({ addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn() }));
vi.mock('@/app/actions/reactions', () => ({ toggleLike: vi.fn(async () => ({ liked: true, count: 5 })) }));
vi.mock('@/app/actions/post', () => ({ deletePost: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const AUTHOR = '5051697b-7014-408c-9159-d9c23df77b19';
const post = {
  id: 'p1', authorId: AUTHOR, content: '오늘 보드게임 재밌었어요', createdAt: new Date('2026-10-01T10:00:00Z'),
  author: { id: AUTHOR, username: 'kim.ace', nickname: '보드왕', department: '개발팀', profileImageUrl: null },
  images: [],
};

describe('자유게시판 피드', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(db.query.posts.findMany).mockResolvedValue([post] as never);
    vi.mocked(getMemberBadges).mockResolvedValue(new Map([[AUTHOR, { kind: 'seasons' as const, count: 3 }]]));
    vi.mocked(getLikeSummaries).mockResolvedValue(new Map([['p1', { count: 4, liked: false }]]));
    vi.mocked(getComments).mockResolvedValue(new Map([['p1', []]]));
  });

  it('게시글마다 좋아요 수와 댓글 수를 보여주고, 피드의 글들을 한 번에 조회한다', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'viewer', username: 'v', isAdmin: false, mustChangePin: false, expiresAt: new Date() });
    render(await Page());
    const article = screen.getByRole('article');
    // 회원은 실제로 좋아요가 눌린다(로그인 안내가 아님).
    fireEvent.click(within(article).getByRole('button', { name: '좋아요 4' }));
    expect(await within(article).findByRole('button', { name: '좋아요 5' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(article).queryByText('로그인하면 좋아요를 누를 수 있습니다.')).toBeNull();
    expect(within(article).getByRole('button', { name: '댓글 0' })).toBeInTheDocument();
    expect(getLikeSummaries).toHaveBeenCalledWith('post', ['p1'], 'viewer');
    expect(getComments).toHaveBeenCalledWith('post', ['p1'], 'viewer');
  });

  it('비회원이 좋아요를 누르면 로그인 안내만 한다', async () => {
    render(await Page());
    const article = screen.getByRole('article');
    fireEvent.click(within(article).getByRole('button', { name: '좋아요 4' }));
    expect(within(article).getByRole('alert')).toHaveTextContent('로그인하면 좋아요를 누를 수 있습니다.');
    expect(getLikeSummaries).toHaveBeenCalledWith('post', ['p1'], null);
  });

  it('작성자는 닉네임과 시즌 배지로만 보이고, 아이디와 부서는 보이지 않는다', async () => {
    render(await Page());
    const article = screen.getByRole('article');
    expect(within(article).getByRole('button', { name: '보드왕 Lv.3' })).toBeInTheDocument();
    expect(article).not.toHaveTextContent('kim.ace');
    expect(article).not.toHaveTextContent('개발팀');
    // 화면의 작성자 배지를 한 번의 쿼리로 계산한다.
    expect(getMemberBadges).toHaveBeenCalledTimes(1);
    expect(getMemberBadges).toHaveBeenCalledWith([AUTHOR]);
  });

  it('게시글 사진을 순서대로 캐러셀로 보여주고, 경로는 공개 URL로 바꾼다', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([
      { ...post, images: [{ storagePath: `${AUTHOR}/1.png` }, { storagePath: `${AUTHOR}/2.png` }] },
    ] as never);
    render(await Page());
    const thumbs = within(screen.getByRole('article')).getAllByRole('button', { name: /크게 보기$/ });
    expect(thumbs.map((b) => b.querySelector('img')!.getAttribute('src'))).toEqual([
      `https://example.supabase.co/storage/v1/object/public/post_images/${AUTHOR}/1.png`,
      `https://example.supabase.co/storage/v1/object/public/post_images/${AUTHOR}/2.png`,
    ]);
  });

  it('사진이 여러 장이면 화면 폭 캐러셀(사진 n/N)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([
      { ...post, images: [{ storagePath: `${AUTHOR}/1.png` }, { storagePath: `${AUTHOR}/2.png` }] },
    ] as never);
    render(await Page());
    expect(within(screen.getByRole('article')).getByRole('region', { name: '사진 2장' })).toBeInTheDocument();
  });

  it('작성 시각은 상대 시간으로, 정확한 시각은 time 요소의 dateTime에 둔다', async () => {
    render(await Page());
    const time = screen.getByRole('article').querySelector('time')!;
    expect(time).toHaveAttribute('dateTime', '2026-10-01T10:00:00.000Z');
    // 기준 시각에 따라 바뀌므로 형식만 본다(N일 전 / M월 D일 등)
    expect(time.textContent).toMatch(/전$|일$|방금/);
  });

  it('본인 글에만 ··· 메뉴(수정·삭제)가 있다', async () => {
    render(await Page());
    expect(screen.queryByRole('button', { name: '게시글 메뉴' })).toBeNull();
    vi.mocked(getSession).mockResolvedValue({ userId: AUTHOR, username: 'kim.ace', isAdmin: false, mustChangePin: false, expiresAt: new Date() });
    render(await Page());
    expect(screen.getByRole('button', { name: '게시글 메뉴' })).toBeInTheDocument();
  });

  it('글이 없으면 빈 화면 안내', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([] as never);
    render(await Page());
    expect(screen.getByText('아직 등록된 게시글이 없어요')).toBeInTheDocument();
  });

  it('프로필 사진이 없으면 닉네임 첫 글자', async () => {
    render(await Page());
    expect(within(screen.getByRole('article')).getByText('보')).toBeInTheDocument();
  });
});

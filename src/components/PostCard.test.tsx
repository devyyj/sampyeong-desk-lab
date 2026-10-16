import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { FeedItem } from '@/lib/feed';
import PostCard from './PostCard';

vi.mock('@/app/actions/profile', () => ({ getProfile: vi.fn() }));
vi.mock('@/app/actions/comments', () => ({ addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn() }));
vi.mock('@/app/actions/reactions', () => ({ toggleLike: vi.fn() }));
vi.mock('@/app/actions/post', () => ({ deletePost: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const base: FeedItem = {
  id: 'p1',
  authorId: 'u1',
  author: { id: 'u1', nickname: '보드왕', profileImageUrl: null },
  badge: { kind: 'seasons', count: 3 },
  content: '오늘 재밌었어요',
  createdAt: '2026-10-17T02:30:00.000Z',
  createdLabel: '30분 전',
  activity: null,
  images: [],
  photoCount: 0,
  photosLocked: false,
  likeCount: 4,
  liked: false,
  comments: [],
  canEdit: false,
};
const activity: FeedItem = {
  ...base,
  id: 'a1',
  content: '• 테마',
  activity: { title: '제 7회 방탈출 정기모임', type: 'ESCAPE_ROOM', seasonName: '시즌 4', date: '2026-07-31' },
  images: [{ src: 'https://signed/0', alt: '제 7회 방탈출 정기모임 사진 1' }],
  photoCount: 1,
};

describe('PostCard', () => {
  it('자유글: 작성자·상대 시간·본문·반응. 시간을 누르면 상세로 간다', () => {
    render(<PostCard item={base} />);
    const card = screen.getByRole('article');
    expect(within(card).getByRole('button', { name: '보드왕 Lv.3' })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: '30분 전' })).toHaveAttribute('href', '/posts/p1');
    expect(card.querySelector('time')).toHaveAttribute('dateTime', '2026-10-17T02:30:00.000Z');
    expect(within(card).getByText('오늘 재밌었어요')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: '좋아요 4' })).toBeInTheDocument();
    // 자유글에는 활동 머리 정보가 없다.
    expect(within(card).queryByRole('heading')).toBeNull();
  });

  it('활동 기록: 종류·시즌·모임 날짜와 굵은 제목(상세 링크), 사진 캐러셀', () => {
    render(<PostCard item={activity} />);
    const card = screen.getByRole('article');
    expect(within(card).getByText('방탈출')).toBeInTheDocument();
    expect(within(card).getByText('시즌 4')).toBeInTheDocument();
    expect(within(card).getByText(/7월 31일 \(금\)|2026년 7월 31일 \(금\)/)).toBeInTheDocument();
    const title = within(card).getByRole('heading', { name: '제 7회 방탈출 정기모임' });
    expect(within(title).getByRole('link')).toHaveAttribute('href', '/posts/a1');
    // 피드에서는 사진을 작은 썸네일 줄로 보여준다(화면 폭 캐러셀이 아님).
    const photos = within(card).getByRole('region', { name: '사진 1장' });
    expect(photos).not.toHaveAttribute('aria-roledescription', 'carousel');
    expect(within(photos).getByRole('button', { name: '제 7회 방탈출 정기모임 사진 1 크게 보기' })).toBeInTheDocument();
  });

  it('상세에서는 사진을 화면 폭 캐러셀로 크게 보여준다', () => {
    render(<PostCard item={activity} variant="detail" />);
    expect(screen.getByRole('region', { name: '사진 1장' })).toHaveAttribute('aria-roledescription', 'carousel');
  });

  it('비회원에게 잠긴 활동 사진은 장수와 로그인 안내만 보여준다', () => {
    render(<PostCard item={{ ...activity, images: [], photoCount: 3, photosLocked: true }} loginHref="/login?redirect=%2F" />);
    const card = screen.getByRole('article');
    expect(within(card).getByText('로그인하면 사진 3장을 볼 수 있어요')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login?redirect=%2F');
    expect(card.querySelector('img')).toBeNull();
  });

  it('수정·삭제 메뉴는 canEdit일 때만', () => {
    const { unmount } = render(<PostCard item={base} />);
    expect(screen.queryByRole('button', { name: '게시글 메뉴' })).toBeNull();
    unmount();
    render(<PostCard item={{ ...base, canEdit: true }} />);
    expect(screen.getByRole('button', { name: '게시글 메뉴' })).toBeInTheDocument();
  });

  it('상세에서는 제목이 링크가 아니고 본문을 접지 않으며 댓글을 펼쳐 둔다', () => {
    const long = '가'.repeat(300);
    render(<PostCard item={{ ...activity, content: long }} variant="detail" />);
    const card = screen.getByRole('article');
    expect(within(card).getByRole('heading', { level: 2, name: '제 7회 방탈출 정기모임' })).toBeInTheDocument();
    expect(within(card).queryByRole('link', { name: '제 7회 방탈출 정기모임' })).toBeNull();
    expect(within(card).queryByRole('button', { name: '더 보기' })).toBeNull();
    expect(within(card).getByRole('heading', { name: '댓글 0' })).toBeInTheDocument();
  });
});

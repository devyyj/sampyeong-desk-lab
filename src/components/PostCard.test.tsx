import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { FeedItem } from '@/lib/feed';
import PostCard from './PostCard';

vi.mock('@/app/actions/profile', () => ({ getProfile: vi.fn() }));
vi.mock('@/app/actions/comments', () => ({ addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn() }));
vi.mock('@/app/actions/reactions', () => ({ setLike: vi.fn() }));
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
  seasonName: null,
  meetingDate: null,
  meetingDateLabel: null,
  tags: [],
  images: [],
  photoCount: 0,
  photosLocked: false,
  likeCount: 4,
  liked: false,
  comments: [],
  canEdit: false,
};
/** 태그·모임 날짜·시즌을 입력하고 사진이 있는 글 */
const meeting: FeedItem = {
  ...base,
  id: 'a1',
  content: '제 7회 방탈출 정기모임\n• 테마',
  createdAt: '2026-07-31',
  createdLabel: '7월 31일',
  seasonName: '시즌 4',
  meetingDate: '2026-07-31',
  meetingDateLabel: '2026년 7월 31일 (금)',
  tags: ['방탈출', '정기 모임'],
  images: [{ src: 'https://signed/0', alt: '게시글 사진 1' }],
  photoCount: 1,
};

describe('PostCard', () => {
  it('선택 정보가 없는 글: 작성자·날짜 하나·본문·반응만. 시간을 누르면 상세로 간다', () => {
    render(<PostCard item={base} />);
    const card = screen.getByRole('article');
    expect(within(card).getByRole('button', { name: '보드왕 Lv.3' })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: '30분 전' })).toHaveAttribute('href', '/posts/p1');
    expect(card.querySelectorAll('time')).toHaveLength(1);
    expect(within(card).getByText('오늘 재밌었어요')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: '좋아요 4' })).toBeInTheDocument();
    // 입력하지 않은 시즌·태그는 그리지 않는다.
    expect(within(card).queryByRole('list', { name: '태그' })).toBeNull();
    expect(within(card).queryByText(/^시즌/)).toBeNull();
    expect(within(card).queryByText(/모임 날짜/)).toBeNull();
  });

  it('선택 정보를 입력한 글: 머리줄 날짜, 본문의 모임 날짜, 시즌(회색 바탕 없음), #태그 링크(누르면 그 태그 모아 보기)', () => {
    render(<PostCard item={meeting} />);
    const card = screen.getByRole('article');
    const times = card.querySelectorAll('time');
    expect(times[0]).toHaveAttribute('dateTime', '2026-07-31');
    expect(times[0]).toHaveTextContent('7월 31일');
    // 모임 날짜를 고른 글은 본문에 모임 날짜를 분명하게 적는다(연도·요일까지).
    const meetingLine = within(card).getByText('2026년 7월 31일 (금)');
    expect(meetingLine.closest('time')).toHaveAttribute('dateTime', '2026-07-31');
    expect(within(card).getByText(/모임 날짜/)).toBeInTheDocument();
    const season = within(card).getByText('시즌 4');
    expect(season.className).not.toMatch(/bg-/);
    const tags = within(within(card).getByRole('list', { name: '태그' })).getAllByRole('link');
    expect(tags.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['#방탈출', '/?tag=%EB%B0%A9%ED%83%88%EC%B6%9C'],
      ['#정기 모임', '/?tag=%EC%A0%95%EA%B8%B0+%EB%AA%A8%EC%9E%84'],
    ]);
    // 피드에서는 사진을 작은 썸네일 줄로 보여준다(화면 폭 캐러셀이 아님).
    const photos = within(card).getByRole('region', { name: '사진 1장' });
    expect(photos).not.toHaveAttribute('aria-roledescription', 'carousel');
  });

  it('피드 카드는 본문 위 정보(작성자·날짜·시즌·모임 날짜)와 본문 이하(본문·태그·반응)를 구역으로 나눈다', () => {
    render(<PostCard item={meeting} />);
    const card = screen.getByRole('article');
    const header = card.querySelector('header')!;
    // 위 구역: 작성자 줄 + 시즌 + 모임 날짜
    expect(within(header).getByRole('button', { name: '보드왕 Lv.3' })).toBeInTheDocument();
    expect(within(header).getByText('시즌 4')).toBeInTheDocument();
    expect(within(header).getByText('2026년 7월 31일 (금)')).toBeInTheDocument();
    expect(within(header).queryByText(/제 7회 방탈출/)).toBeNull();
    // 아래 구역: 본문·태그·반응. 위 구역과 구분선·배경으로 갈린다.
    const body = within(card).getByText(/제 7회 방탈출/).closest('[data-section="body"]')!;
    expect(body).toHaveClass('border-t');
    expect(within(body as HTMLElement).getByRole('list', { name: '태그' })).toBeInTheDocument();
    expect(within(body as HTMLElement).getByRole('button', { name: '좋아요 4' })).toBeInTheDocument();
    expect(header).toHaveClass('bg-muted/50');
  });

  it('시즌과 모임 날짜는 한 줄에 두고, 시즌은 본문색·굵게 강조한다', () => {
    render(<PostCard item={meeting} />);
    const card = screen.getByRole('article');
    const season = within(card).getByText('시즌 4');
    const line = season.parentElement!;
    expect(line).toHaveTextContent('2026년 7월 31일 (금)');
    expect(line).toHaveClass('flex');
    expect(season).toHaveClass('text-foreground', 'font-extrabold');
  });

  it('시즌만 있거나 모임 날짜만 있어도 그 줄을 그린다', () => {
    const { unmount } = render(<PostCard item={{ ...meeting, meetingDate: null, meetingDateLabel: null }} />);
    expect(screen.getByText('시즌 4')).toBeInTheDocument();
    expect(screen.queryByText(/모임 날짜/)).toBeNull();
    unmount();
    render(<PostCard item={{ ...meeting, seasonName: null }} />);
    expect(screen.getByText('2026년 7월 31일 (금)')).toBeInTheDocument();
    expect(screen.queryByText(/^시즌/)).toBeNull();
  });

  it('피드 작성자 정보는 크게: 큰 프로필 사진과 큰 닉네임', () => {
    render(<PostCard item={base} />);
    const header = screen.getByRole('article').querySelector('header')!;
    expect(within(header).getByRole('button', { name: '보드왕 Lv.3' })).toHaveClass('text-[18px]');
    expect((header.querySelector('span.rounded-full') as HTMLElement).style.width).toBe('42px');
  });

  it('상세에서는 사진을 화면 폭 캐러셀로 크게, 본문을 접지 않고, 댓글을 펼쳐 둔다', () => {
    render(<PostCard item={{ ...meeting, content: '가'.repeat(300) }} variant="detail" />);
    expect(screen.getByRole('region', { name: '사진 1장' })).toHaveAttribute('aria-roledescription', 'carousel');
    expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
    expect(screen.getByRole('heading', { name: '댓글 0' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '태그' })).toBeInTheDocument();
  });

  it('비회원에게 잠긴 사진은 장수와 로그인 안내만 보여준다', () => {
    render(<PostCard item={{ ...base, photoCount: 3, photosLocked: true }} loginHref="/login?redirect=%2F" />);
    const card = screen.getByRole('article');
    expect(within(card).getByText('로그인하면 사진 3장을 볼 수 있어요')).toBeInTheDocument();
    expect(within(card).getAllByRole('link', { name: '로그인' })[0]).toHaveAttribute('href', '/login?redirect=%2F');
    expect(card.querySelector('img')).toBeNull();
  });

  it('수정·삭제 메뉴는 canEdit일 때만', () => {
    const { unmount } = render(<PostCard item={base} />);
    expect(screen.queryByRole('button', { name: '게시글 메뉴' })).toBeNull();
    unmount();
    render(<PostCard item={{ ...base, canEdit: true }} />);
    expect(screen.getByRole('button', { name: '게시글 메뉴' })).toBeInTheDocument();
  });
});

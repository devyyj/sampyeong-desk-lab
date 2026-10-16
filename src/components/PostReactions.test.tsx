import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PostReactions from './PostReactions';
import type { CommentView } from '@/lib/community';

vi.mock('@/app/actions/comments', () => ({ addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn() }));
vi.mock('@/app/actions/reactions', () => ({ toggleLike: vi.fn() }));
vi.mock('@/app/actions/profile', () => ({ getProfile: vi.fn() }));

const comment: CommentView = {
  id: 'c1', authorId: 'a', nickname: '보드왕', badge: null, content: '첫 댓글', createdLabel: '2026. 10. 16. 12:00',
  edited: false, likeCount: 0, liked: false,
};

const renderIt = (comments: CommentView[] = [comment]) =>
  render(
    <PostReactions postId="p1" liked={false} likeCount={3} comments={comments} viewer={null} loginHref="/login">
      <p>본문</p>
    </PostReactions>,
  );

describe('PostReactions', () => {
  it('좋아요·댓글 버튼 줄 아래에 본문(children)을 둔다', () => {
    renderIt();
    expect(screen.getByRole('button', { name: '좋아요 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '댓글 1' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.getByText('본문')).toBeInTheDocument();
  });

  it('댓글은 피드에 펼치지 않고, 💬를 누르면 댓글 시트로 연다', () => {
    renderIt();
    expect(screen.queryByText('첫 댓글')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '댓글 1' }));
    const sheet = screen.getByRole('dialog', { name: '댓글' });
    expect(within(sheet).getByText('첫 댓글')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('댓글이 있으면 "댓글 N개 모두 보기"로도 연다', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: '댓글 1개 모두 보기' }));
    expect(screen.getByRole('dialog', { name: '댓글' })).toBeInTheDocument();
  });

  it('댓글이 없으면 "모두 보기" 줄을 그리지 않는다', () => {
    renderIt([]);
    expect(screen.queryByRole('button', { name: /모두 보기/ })).toBeNull();
  });
});

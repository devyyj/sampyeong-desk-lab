import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PostReactions from './PostReactions';
import type { CommentView } from '@/lib/community';

vi.mock('@/app/actions/comments', () => ({ addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn() }));
vi.mock('@/app/actions/reactions', () => ({ toggleLike: vi.fn() }));
vi.mock('@/app/actions/profile', () => ({ getProfile: vi.fn() }));

const comment: CommentView = {
  id: 'c1', authorId: 'a', nickname: '보드왕', badge: null, content: '첫 댓글', createdLabel: '2026. 10. 16. 12:00',
  edited: false, likeCount: 0, liked: false,
};

describe('PostReactions', () => {
  it('좋아요 수와 댓글 수를 보여주고, 댓글은 💬를 눌러야 펼쳐진다', () => {
    render(<PostReactions postId="p1" liked={false} likeCount={3} comments={[comment]} viewer={null} loginHref="/login" />);
    expect(screen.getByRole('button', { name: '좋아요 3' })).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: '댓글 1' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('첫 댓글')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('첫 댓글')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByText('첫 댓글')).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { deletePost } from '@/app/actions/post';
import PostMenu from './PostMenu';

const refresh = vi.fn();
vi.mock('@/app/actions/post', () => ({ deletePost: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

describe('PostMenu', () => {
  beforeEach(() => vi.clearAllMocks());

  it('··· 를 누르면 수정·삭제 시트가 열린다', () => {
    render(<PostMenu postId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: '게시글 메뉴' }));
    const sheet = screen.getByRole('dialog', { name: '게시글' });
    expect(within(sheet).getByRole('link', { name: '수정' })).toHaveAttribute('href', '/posts/p1/edit');
    expect(within(sheet).getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('삭제는 확인을 받은 뒤 지우고 피드를 새로 그린다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<PostMenu postId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: '게시글 메뉴' }));

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(deletePost).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});

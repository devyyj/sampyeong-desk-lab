import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CommentSection from './CommentSection';
import { addComment, updateComment, deleteComment } from '@/app/actions/comments';
import type { CommentView } from '@/lib/community';

vi.mock('@/app/actions/comments', () => ({
  addComment: vi.fn(async () => ({ ok: true })),
  updateComment: vi.fn(async () => ({ ok: true })),
  deleteComment: vi.fn(async () => ({ ok: true })),
}));
vi.mock('@/app/actions/reactions', () => ({ toggleLike: vi.fn() }));
vi.mock('@/app/actions/profile', () => ({ getProfile: vi.fn() }));

const ME = 'me-id';
const POST = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const view = (o: Partial<CommentView>): CommentView => ({
  id: 'c', authorId: 'someone', nickname: '누군가', badge: null, content: '내용', createdLabel: '5분 전',
  edited: false, likeCount: 0, liked: false, ...o,
});
const mine = view({ id: 'c1', authorId: ME, nickname: '나', content: '내 댓글', edited: true, likeCount: 2, liked: true });
const theirs = view({ id: 'c2', authorId: 'other', nickname: '남', content: '남의 댓글', badge: { kind: 'seasons', count: 3 } });
const itemOf = (text: string) => screen.getByText(text).closest('li')!;

describe('CommentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('댓글을 닉네임·배지·시간·수정됨·내용·좋아요와 함께 보여준다', () => {
    render(<CommentSection target="post" targetId={POST} comments={[mine, theirs]} viewer={null} loginHref="/login" />);
    const first = itemOf('내 댓글');
    expect(within(first).getByRole('button', { name: '나' })).toBeInTheDocument();
    expect(first).toHaveTextContent('5분 전');
    expect(first).toHaveTextContent('(수정됨)');
    expect(within(first).getByRole('button', { name: '좋아요 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(itemOf('남의 댓글')).getByRole('button', { name: '남 Lv.3' })).toBeInTheDocument();
    expect(itemOf('남의 댓글')).not.toHaveTextContent('(수정됨)');
  });

  it('비회원: 작성 폼·수정·삭제 없이 로그인 안내', () => {
    render(<CommentSection target="post" targetId={POST} comments={[mine]} viewer={null} loginHref="/login?redirect=%2F" />);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login?redirect=%2F');
  });

  it('회원: 본인 댓글만 수정·삭제, 남의 댓글에는 버튼이 없다', () => {
    render(<CommentSection target="post" targetId={POST} comments={[mine, theirs]} viewer={{ id: ME, isAdmin: false }} loginHref="/login" />);
    expect(within(itemOf('내 댓글')).getByRole('button', { name: '수정' })).toBeInTheDocument();
    expect(within(itemOf('내 댓글')).getByRole('button', { name: '삭제' })).toBeInTheDocument();
    expect(within(itemOf('남의 댓글')).queryByRole('button', { name: '수정' })).toBeNull();
    expect(within(itemOf('남의 댓글')).queryByRole('button', { name: '삭제' })).toBeNull();
  });

  it('관리자: 남의 댓글은 삭제만 가능(수정 불가)', () => {
    render(<CommentSection target="post" targetId={POST} comments={[theirs]} viewer={{ id: ME, isAdmin: true }} loginHref="/login" />);
    expect(within(itemOf('남의 댓글')).getByRole('button', { name: '삭제' })).toBeInTheDocument();
    expect(within(itemOf('남의 댓글')).queryByRole('button', { name: '수정' })).toBeNull();
  });

  it('댓글을 쓰면 대상과 함께 addComment로 보내고, 성공하면 입력란을 비운다', async () => {
    render(<CommentSection target="post" targetId={POST} comments={[]} viewer={{ id: ME, isAdmin: false }} loginHref="/login" />);
    expect(screen.getByText('첫 댓글을 남겨보세요.')).toBeInTheDocument();
    const box = screen.getByRole('textbox', { name: '댓글 쓰기' });
    fireEvent.change(box, { target: { value: '좋은 모임이었어요' } });
    fireEvent.click(screen.getByRole('button', { name: '댓글 달기' }));
    await waitFor(() => expect(addComment).toHaveBeenCalled());
    const fd = vi.mocked(addComment).mock.calls[0][1] as FormData;
    expect(Object.fromEntries(fd)).toEqual({ target: 'post', targetId: POST, content: '좋은 모임이었어요' });
    await waitFor(() => expect(screen.getByRole('textbox', { name: '댓글 쓰기' })).toHaveValue(''));
  });

  it('작성 실패 시 오류를 보여주고 입력은 남긴다', async () => {
    vi.mocked(addComment).mockResolvedValueOnce({ error: '찾을 수 없습니다.' });
    render(<CommentSection target="post" targetId={POST} comments={[]} viewer={{ id: ME, isAdmin: false }} loginHref="/login" />);
    fireEvent.change(screen.getByRole('textbox', { name: '댓글 쓰기' }), { target: { value: '안녕' } });
    fireEvent.click(screen.getByRole('button', { name: '댓글 달기' }));
    expect(await screen.findByText('찾을 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '댓글 쓰기' })).toHaveValue('안녕');
  });

  it('수정: 그 자리에서 고쳐 저장하고, 취소하면 원래대로', async () => {
    render(<CommentSection target="post" targetId={POST} comments={[mine]} viewer={{ id: ME, isAdmin: false }} loginHref="/login" />);
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    const box = screen.getByRole('textbox', { name: '댓글 수정' });
    expect(box).toHaveValue('내 댓글');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('textbox', { name: '댓글 수정' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    fireEvent.change(screen.getByRole('textbox', { name: '댓글 수정' }), { target: { value: '고친 댓글' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(updateComment).toHaveBeenCalled());
    expect(Object.fromEntries(vi.mocked(updateComment).mock.calls[0][1] as FormData)).toEqual({ id: 'c1', content: '고친 댓글' });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: '댓글 수정' })).toBeNull());
  });

  it('삭제: 앱 확인 팝업을 거쳐 deleteComment, 취소하면 지우지 않는다', async () => {
    render(<CommentSection target="post" targetId={POST} comments={[mine]} viewer={{ id: ME, isAdmin: false }} loginHref="/login" />);
    const deleteButton = within(itemOf('내 댓글')).getByRole('button', { name: '삭제' });
    fireEvent.click(deleteButton);
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: '댓글을 삭제할까요?' })).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(deleteComment).not.toHaveBeenCalled();

    fireEvent.click(deleteButton);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(deleteComment).toHaveBeenCalledWith('c1'));
  });
});

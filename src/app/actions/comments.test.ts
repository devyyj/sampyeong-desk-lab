import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/db';
import { getSession } from '@/lib/session';
import { getAdminUser } from '@/lib/admin';
import { revalidatePath } from 'next/cache';
import { addComment, updateComment, deleteComment } from './comments';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const values = vi.fn();
const set = vi.fn();
const deleteWhere = vi.fn();
vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({ values })),
    update: vi.fn(() => ({ set: (v: unknown) => ({ where: () => set(v) }) })),
    delete: vi.fn(() => ({ where: deleteWhere })),
    query: { comments: { findFirst: vi.fn() } },
  },
}));

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const POST = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const COMMENT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const session = { userId: ME, username: 'me', isAdmin: false, mustChangePin: false, expiresAt: new Date() };
const form = (f: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.append(k, v);
  return fd;
};
const comment = (authorId = ME) => ({ id: COMMENT, authorId, postId: POST, activityId: null });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue(session);
  vi.mocked(getAdminUser).mockResolvedValue(null);
  values.mockResolvedValue(undefined);
  set.mockResolvedValue(undefined);
  deleteWhere.mockResolvedValue(undefined);
});

describe('addComment', () => {
  it('로그인 필요, 대상·id·내용 검사', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect(await addComment(null, form({ target: 'post', targetId: POST, content: 'hi' }))).toEqual({ error: '로그인이 필요합니다.' });
    expect(await addComment(null, form({ target: 'user', targetId: POST, content: 'hi' }))).toEqual({ error: '잘못된 요청입니다.' });
    expect(await addComment(null, form({ target: 'post', targetId: 'x', content: 'hi' }))).toEqual({ error: '잘못된 요청입니다.' });
    expect(await addComment(null, form({ target: 'post', targetId: POST, content: '   ' }))).toEqual({ error: '댓글은 1~1000자로 입력해주세요.' });
    expect(await addComment(null, form({ target: 'post', targetId: POST, content: '가'.repeat(1001) }))).toEqual({ error: '댓글은 1~1000자로 입력해주세요.' });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('게시글 댓글을 (공백 제거 후) post_id에 저장하고 피드·상세를 다시 그린다', async () => {
    expect(await addComment(null, form({ target: 'post', targetId: POST, content: '  좋아요! ' }))).toEqual({ ok: true });
    expect(values).toHaveBeenCalledWith({ postId: POST, authorId: ME, content: '좋아요!' });
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith(`/posts/${POST}`);
  });

  it('활동 기록은 게시글로 합쳐져 activity 대상은 받지 않는다', async () => {
    expect(await addComment(null, form({ target: 'activity', targetId: POST, content: '재밌었어요' }))).toEqual({ error: '잘못된 요청입니다.' });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('CRLF 줄바꿈은 LF로 맞춰 저장한다', async () => {
    await addComment(null, form({ target: 'post', targetId: POST, content: '한 줄\r\n두 줄' }));
    expect(values).toHaveBeenLastCalledWith({ postId: POST, authorId: ME, content: '한 줄\n두 줄' });
  });

  it('대상이 그 사이 삭제됐으면(FK 위반) 찾을 수 없음', async () => {
    values.mockRejectedValueOnce(Object.assign(new Error('x'), { cause: { code: '23503' } }));
    expect(await addComment(null, form({ target: 'post', targetId: POST, content: 'hi' }))).toEqual({ error: '찾을 수 없습니다.' });
  });
});

describe('updateComment', () => {
  it('본인 댓글만 수정한다(관리자도 남의 댓글은 수정 불가)', async () => {
    vi.mocked(db.query.comments.findFirst).mockResolvedValueOnce(comment(OTHER) as never);
    vi.mocked(getAdminUser).mockResolvedValue({ id: ME, isAdmin: true } as never);
    expect(await updateComment(null, form({ id: COMMENT, content: '수정' }))).toEqual({ error: '수정 권한이 없습니다.' });
    expect(set).not.toHaveBeenCalled();
  });

  it('내용과 수정 시각을 갱신한다', async () => {
    vi.mocked(db.query.comments.findFirst).mockResolvedValueOnce(comment() as never);
    expect(await updateComment(null, form({ id: COMMENT, content: ' 고친 댓글 ' }))).toEqual({ ok: true });
    expect(set).toHaveBeenCalledWith({ content: '고친 댓글', updatedAt: expect.anything() });
  });

  it('없는 댓글·잘못된 id·빈 내용', async () => {
    vi.mocked(db.query.comments.findFirst).mockResolvedValueOnce(undefined as never);
    expect(await updateComment(null, form({ id: COMMENT, content: 'x' }))).toEqual({ error: '찾을 수 없습니다.' });
    expect(await updateComment(null, form({ id: 'x', content: 'x' }))).toEqual({ error: '잘못된 요청입니다.' });
    expect(await updateComment(null, form({ id: COMMENT, content: '' }))).toEqual({ error: '댓글은 1~1000자로 입력해주세요.' });
  });
});

describe('deleteComment', () => {
  it('로그인 필요, 남의 댓글은 일반 회원이 지울 수 없다', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect(await deleteComment(COMMENT)).toEqual({ error: '로그인이 필요합니다.' });
    vi.mocked(db.query.comments.findFirst).mockResolvedValueOnce(comment(OTHER) as never);
    expect(await deleteComment(COMMENT)).toEqual({ error: '삭제 권한이 없습니다.' });
    expect(deleteWhere).not.toHaveBeenCalled();
  });

  it('본인 댓글은 지운다', async () => {
    vi.mocked(db.query.comments.findFirst).mockResolvedValueOnce(comment() as never);
    expect(await deleteComment(COMMENT)).toEqual({ ok: true });
    expect(deleteWhere).toHaveBeenCalled();
    // 관리자 여부는 본인 댓글이면 확인할 필요가 없다.
    expect(getAdminUser).not.toHaveBeenCalled();
  });

  it('관리자는 (DB로 다시 확인한 뒤) 남의 댓글도 지울 수 있다', async () => {
    vi.mocked(db.query.comments.findFirst).mockResolvedValueOnce(comment(OTHER) as never);
    vi.mocked(getAdminUser).mockResolvedValueOnce({ id: ME, isAdmin: true } as never);
    expect(await deleteComment(COMMENT)).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith(`/posts/${POST}`);
  });

  it('이미 지워진 댓글은 찾을 수 없음', async () => {
    vi.mocked(db.query.comments.findFirst).mockResolvedValueOnce(undefined as never);
    expect(await deleteComment(COMMENT)).toEqual({ error: '찾을 수 없습니다.' });
  });
});

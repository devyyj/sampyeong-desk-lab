import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { toggleLike } from './reactions';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// 호출된 테이블과 결과를 지정할 수 있는 최소한의 체인 가짜.
const deleted = vi.fn();
const inserted = vi.fn();
const counted = vi.fn();
const tableOf = (t: unknown) => getTableConfig(t as Parameters<typeof getTableConfig>[0]).name;
vi.mock('@/db', () => ({
  db: {
    delete: vi.fn((t) => ({ where: () => ({ returning: () => deleted(tableOf(t)) }) })),
    insert: vi.fn((t) => ({ values: (v: unknown) => ({ onConflictDoNothing: () => inserted(tableOf(t), v) }) })),
    select: vi.fn(() => ({ from: (t: unknown) => ({ where: () => counted(tableOf(t)) }) })),
  },
}));

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TARGET = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('toggleLike', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ userId: ME, username: 'me', isAdmin: false, mustChangePin: false, expiresAt: new Date() });
    deleted.mockResolvedValue([]);
    inserted.mockResolvedValue(undefined);
    counted.mockResolvedValue([{ count: 3 }]);
  });

  it('로그인·대상 종류·id 형식을 검사한다', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect(await toggleLike('post', TARGET)).toEqual({ error: '로그인이 필요합니다.' });
    expect(await toggleLike('user' as never, TARGET)).toEqual({ error: '잘못된 요청입니다.' });
    // 활동 기록은 게시글로 합쳐져 별도 대상이 없다(post로 누른다).
    expect(await toggleLike('activity' as never, TARGET)).toEqual({ error: '잘못된 요청입니다.' });
    expect(await toggleLike('post', 'nope')).toEqual({ error: '잘못된 요청입니다.' });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('아직 누르지 않았으면 추가(중복은 무시)하고 liked=true와 새 개수를 돌려준다', async () => {
    expect(await toggleLike('post', TARGET)).toEqual({ liked: true, count: 3 });
    expect(deleted).toHaveBeenCalledWith('post_likes');
    expect(inserted).toHaveBeenCalledWith('post_likes', { postId: TARGET, userId: ME });
    expect(counted).toHaveBeenCalledWith('post_likes');
  });

  it('이미 눌렀으면 지우고 liked=false', async () => {
    deleted.mockResolvedValueOnce([{ userId: ME }]);
    counted.mockResolvedValueOnce([{ count: 2 }]);
    expect(await toggleLike('post', TARGET)).toEqual({ liked: false, count: 2 });
    expect(deleted).toHaveBeenCalledWith('post_likes');
    expect(inserted).not.toHaveBeenCalled();
  });

  it('댓글 좋아요는 comment_likes에 쓴다', async () => {
    await toggleLike('comment', TARGET);
    expect(inserted).toHaveBeenCalledWith('comment_likes', { commentId: TARGET, userId: ME });
  });

  it('보드게임 좋아요는 board_game_likes에 쓰고 보드게임 목록을 다시 그린다', async () => {
    await toggleLike('boardgame', TARGET);
    expect(inserted).toHaveBeenCalledWith('board_game_likes', { boardGameId: TARGET, userId: ME });
    expect(revalidatePath).toHaveBeenCalledWith('/boardgames');
  });

  it('대상이 그 사이 삭제됐으면(FK 위반) 찾을 수 없음', async () => {
    inserted.mockRejectedValueOnce(Object.assign(new Error('Failed query'), { cause: { code: '23503' } }));
    expect(await toggleLike('post', TARGET)).toEqual({ error: '찾을 수 없습니다.' });
  });

  it('화면 데이터가 바뀌므로 해당 경로를 다시 그린다', async () => {
    await toggleLike('post', TARGET);
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith(`/posts/${TARGET}`);
    vi.mocked(revalidatePath).mockClear();
    await toggleLike('comment', TARGET);
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/posts/[id]', 'page');
  });
});

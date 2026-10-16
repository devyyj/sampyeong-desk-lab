import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPost, updatePost, deletePost, requestPostImageUploads } from './post';
import { getSession } from '@/lib/session';
import { db } from '@/db';
import { redirect } from 'next/navigation';
import { createPostImageUploadUrls, getPostImageInfo, removePostImages } from '@/lib/storage-admin';
import { getAdminUser } from '@/lib/admin';

/**
 * DB 쓰기는 호출 기록만 남기는 가짜 트랜잭션으로 대체한다.
 * values()는 바로 await되기도 하고 .returning()이 붙기도 하므로 둘 다 되게 만든다.
 */
const writes: { op: string; values?: unknown }[] = [];
const NEW_POST = '11111111-1111-4111-8111-111111111111';
const chain = (op: string) => ({
  values: (values: unknown) => {
    writes.push({ op, values });
    return Object.assign(Promise.resolve(), { returning: async () => [{ id: NEW_POST }] });
  },
  set: (values: unknown) => {
    writes.push({ op, values });
    return { where: async () => undefined };
  },
  where: async () => {
    writes.push({ op });
  },
});
const tx = {
  insert: (table: { [k: symbol]: unknown }) => chain(`insert:${tableName(table)}`),
  update: (table: { [k: symbol]: unknown }) => chain(`update:${tableName(table)}`),
  delete: (table: { [k: symbol]: unknown }) => chain(`delete:${tableName(table)}`),
};
const tableName = (table: object) =>
  (table as Record<symbol, string>)[Object.getOwnPropertySymbols(table).find((s) => s.description === 'drizzle:Name')!];

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    query: { posts: { findFirst: vi.fn() }, seasons: { findFirst: vi.fn() } },
    delete: vi.fn(),
  },
}));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn() }));
vi.mock('@/lib/storage-admin', () => ({
  createPostImageUploadUrls: vi.fn(async (paths: string[]) => paths.map((path) => ({ path, token: `t-${path}` }))),
  getPostImageInfo: vi.fn(),
  removePostImages: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const POST = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const session = { userId: ME, username: 'me', isAdmin: false, mustChangePin: false, expiresAt: new Date() };
const myPath = (n: number) => `${ME}/0000000${n}-0000-4000-8000-000000000000.png`;
const okInfo = (paths: string[]) => paths.map(() => ({ size: 1000, contentType: 'image/png' }));
const form = (fields: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const item of [v].flat()) fd.append(k, item);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  writes.length = 0;
  vi.mocked(getSession).mockResolvedValue(session);
  vi.mocked(getPostImageInfo).mockImplementation(async (paths) => okInfo(paths));
  vi.mocked(getAdminUser).mockResolvedValue(null);
  vi.mocked(db.query.seasons.findFirst).mockResolvedValue({ id: 5, name: '시즌 5', period: '26년 4분기' } as never);
});

/** 활동 기록 작성 폼의 기본 입력. */
const activityForm = (o: Record<string, string | string[]> = {}) =>
  form({ kind: 'activity', title: '제 9회 정기모임', activityType: 'REGULAR', activityDate: '2026-10-16', seasonId: '5', content: '• 인원 8명', ...o });

describe('requestPostImageUploads', () => {
  it('로그인이 필요하다', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect(await requestPostImageUploads([{ type: 'image/png', size: 10 }])).toEqual({ error: '로그인이 필요합니다.' });
    expect(createPostImageUploadUrls).not.toHaveBeenCalled();
  });

  it('본인 폴더 안에 새 uuid 경로(확장자는 MIME 기준)로 서명 업로드 토큰을 발급한다', async () => {
    const result = await requestPostImageUploads([{ type: 'image/png', size: 10 }, { type: 'image/jpeg', size: 10 }]);
    expect(result).toEqual({
      uploads: [
        { path: expect.stringMatching(new RegExp(`^${ME}/[0-9a-f-]{36}\\.png$`)), token: expect.any(String) },
        { path: expect.stringMatching(new RegExp(`^${ME}/[0-9a-f-]{36}\\.jpg$`)), token: expect.any(String) },
      ],
    });
  });

  it('버킷은 종류로 정한다: 자유글은 공개 post_images, 활동 기록은 비공개 activity_photos', async () => {
    await requestPostImageUploads([{ type: 'image/png', size: 10 }]);
    expect(createPostImageUploadUrls).toHaveBeenLastCalledWith([expect.stringMatching(`^${ME}/`)], 'post_images');
    await requestPostImageUploads([{ type: 'image/png', size: 10 }], 0, 'activity');
    expect(createPostImageUploadUrls).toHaveBeenLastCalledWith([expect.stringMatching(`^${ME}/`)], 'activity_photos');
    // 모르는 값은 자유글로 본다(Storage 정책이 없는 비공개 버킷에 아무 값으로나 들어가지 않게).
    await requestPostImageUploads([{ type: 'image/png', size: 10 }], 0, 'weird' as never);
    expect(createPostImageUploadUrls).toHaveBeenLastCalledWith(expect.any(Array), 'post_images');
  });

  it('개수(기존 사진 포함)·형식·크기 규칙을 서버에서 다시 검사한다', async () => {
    const png = { type: 'image/png', size: 10 };
    expect(await requestPostImageUploads(Array(11).fill(png))).toEqual({ error: '사진은 최대 10장까지 올릴 수 있습니다.' });
    expect(await requestPostImageUploads([png, png], 9)).toEqual({ error: '사진은 최대 10장까지 올릴 수 있습니다.' });
    expect(await requestPostImageUploads([{ type: 'text/html', size: 10 }])).toEqual({ error: '이미지 파일만 올릴 수 있습니다.' });
    expect(await requestPostImageUploads([{ type: 'image/png', size: 10 * 1024 * 1024 + 1 }])).toEqual({ error: '사진은 한 장에 10MB 이하여야 합니다.' });
    expect(await requestPostImageUploads([])).toEqual({ error: '올릴 사진이 없습니다.' });
    expect(createPostImageUploadUrls).not.toHaveBeenCalled();
  });
});

describe('createPost', () => {
  it('로그인·내용 검사', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect(await createPost(null, form({ content: 'x' }))).toEqual({ error: '로그인이 필요합니다.' });
    expect(await createPost(null, form({ content: '   ' }))).toEqual({ error: '내용을 입력해주세요.' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('게시글과 사진 경로를 순서대로 한 트랜잭션에 저장하고 피드로 이동한다', async () => {
    await createPost(null, form({ content: '안녕', imagePaths: [myPath(2), myPath(1)] }));
    expect(getPostImageInfo).toHaveBeenCalledWith([myPath(2), myPath(1)], 'post_images');
    expect(writes).toEqual([
      { op: 'insert:posts', values: { content: '안녕', authorId: ME } },
      {
        op: 'insert:post_images',
        values: [
          { postId: NEW_POST, storagePath: myPath(2), position: 0 },
          { postId: NEW_POST, storagePath: myPath(1), position: 1 },
        ],
      },
    ]);
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('사진이 없으면 post_images에 쓰지 않는다', async () => {
    await createPost(null, form({ content: '글만' }));
    expect(writes.map((w) => w.op)).toEqual(['insert:posts']);
    expect(getPostImageInfo).not.toHaveBeenCalled();
  });

  it('다른 회원 폴더·폴더 밖·형식이 다른 경로는 거부한다', async () => {
    for (const bad of [
      `${OTHER}/00000001-0000-4000-8000-000000000000.png`,
      `${ME}/../${OTHER}/00000001-0000-4000-8000-000000000000.png`,
      `${ME}/x.png`,
      `${ME}/00000001-0000-4000-8000-000000000000.png/extra`,
    ]) {
      expect(await createPost(null, form({ content: 'x', imagePaths: bad })), bad).toEqual({ error: '잘못된 사진 경로입니다.' });
    }
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('같은 경로를 두 번 보내거나 10장을 넘기면 거부한다', async () => {
    expect(await createPost(null, form({ content: 'x', imagePaths: [myPath(1), myPath(1)] }))).toEqual({ error: '잘못된 사진 경로입니다.' });
    const eleven = Array.from({ length: 11 }, (_, i) => `${ME}/${String(i).padStart(8, '0')}-0000-4000-8000-000000000000.png`);
    expect(await createPost(null, form({ content: 'x', imagePaths: eleven }))).toEqual({ error: '사진은 최대 10장까지 올릴 수 있습니다.' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('실제로 올라가지 않은 경로가 있으면 저장하지 않는다', async () => {
    vi.mocked(getPostImageInfo).mockResolvedValueOnce([{ size: 1, contentType: 'image/png' }, null]);
    expect(await createPost(null, form({ content: 'x', imagePaths: [myPath(1), myPath(2)] })))
      .toEqual({ error: '업로드되지 않은 사진이 있습니다. 다시 시도해주세요.' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('브라우저 검사를 우회해 올라간 큰 파일·이미지 아닌 파일은 지우고 거부한다', async () => {
    vi.mocked(getPostImageInfo).mockResolvedValueOnce([{ size: 11 * 1024 * 1024, contentType: 'image/png' }]);
    expect(await createPost(null, form({ content: 'x', imagePaths: myPath(1) }))).toEqual({ error: '사진은 한 장에 10MB 이하여야 합니다.' });
    expect(removePostImages).toHaveBeenCalledWith([myPath(1)], 'post_images');
    vi.mocked(getPostImageInfo).mockResolvedValueOnce([{ size: 10, contentType: 'text/html' }]);
    expect(await createPost(null, form({ content: 'x', imagePaths: myPath(2) }))).toEqual({ error: '이미지 파일만 올릴 수 있습니다.' });
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

describe('createPost (활동 기록)', () => {
  it('활동 칼럼과 함께 저장하고, 사진은 activity_photos에서 확인한다', async () => {
    await createPost(null, activityForm({ imagePaths: myPath(1) }));
    expect(getPostImageInfo).toHaveBeenCalledWith([myPath(1)], 'activity_photos');
    expect(writes[0]).toEqual({
      op: 'insert:posts',
      values: {
        content: '• 인원 8명', authorId: ME, kind: 'activity',
        title: '제 9회 정기모임', activityType: 'REGULAR', activityDate: '2026-10-16', seasonId: 5,
      },
    });
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('활동 입력이 잘못되면 저장하지 않는다', async () => {
    expect(await createPost(null, activityForm({ title: ' ' }))).toEqual({ error: '제목을 입력해주세요.' });
    expect(await createPost(null, activityForm({ activityType: 'PARTY' }))).toEqual({ error: '활동 종류를 골라주세요.' });
    vi.mocked(db.query.seasons.findFirst).mockResolvedValueOnce(undefined as never);
    expect(await createPost(null, activityForm({ seasonId: '99' }))).toEqual({ error: '시즌을 골라주세요.' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('규칙을 어긴 활동 사진은 activity_photos에서 지운다', async () => {
    vi.mocked(getPostImageInfo).mockResolvedValueOnce([{ size: 11 * 1024 * 1024, contentType: 'image/png' }]);
    await createPost(null, activityForm({ imagePaths: myPath(1) }));
    expect(removePostImages).toHaveBeenCalledWith([myPath(1)], 'activity_photos');
  });

  it('자유글에 활동 칼럼을 섞어 보내도 무시한다(kind가 activity일 때만 활동 기록)', async () => {
    await createPost(null, form({ content: '글', title: '몰래', activityType: 'REGULAR' }));
    expect(writes[0]).toEqual({ op: 'insert:posts', values: { content: '글', authorId: ME } });
  });
});

describe('updatePost', () => {
  const existing = (authorId = ME) => ({
    id: POST, authorId, content: '원래',
    images: [
      { id: 'img-a', storagePath: myPath(1), position: 0 },
      { id: 'img-b', storagePath: myPath(2), position: 1 },
    ],
  });

  it('로그인·잘못된 id·남의 글은 거부', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect(await updatePost(null, form({ id: POST, content: 'x' }))).toEqual({ error: '로그인이 필요합니다.' });
    expect(await updatePost(null, form({ id: 'nope', content: 'x' }))).toEqual({ error: '잘못된 요청입니다.' });
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce(existing(OTHER) as never);
    expect(await updatePost(null, form({ id: POST, content: 'x' }))).toEqual({ error: '수정 권한이 없습니다.' });
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce(undefined as never);
    expect(await updatePost(null, form({ id: POST, content: 'x' }))).toEqual({ error: '찾을 수 없습니다.' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('뺀 사진은 행과 파일을 지우고, 남은 사진 → 새 사진 순서로 다시 번호를 매긴다', async () => {
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce(existing() as never);
    await updatePost(null, form({ id: POST, content: '수정', removeImageIds: 'img-a', imagePaths: myPath(3) }));
    expect(writes).toEqual([
      { op: 'update:posts', values: expect.objectContaining({ content: '수정' }) },
      { op: 'delete:post_images' },
      {
        op: 'insert:post_images',
        values: [
          { postId: POST, storagePath: myPath(2), position: 0 },
          { postId: POST, storagePath: myPath(3), position: 1 },
        ],
      },
    ]);
    // 새 사진만 Storage 존재·규칙을 확인한다(기존 사진은 이미 검증됨).
    expect(getPostImageInfo).toHaveBeenCalledWith([myPath(3)], 'post_images');
    expect(removePostImages).toHaveBeenCalledWith([myPath(1)], 'post_images');
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('이 글의 사진이 아닌 id는 무시한다(남의 글 사진을 지울 수 없음)', async () => {
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce(existing() as never);
    await updatePost(null, form({ id: POST, content: '수정', removeImageIds: ['someone-elses', 'img-b'] }));
    expect(removePostImages).toHaveBeenCalledWith([myPath(2)], 'post_images');
    expect(writes.at(-1)).toEqual({ op: 'insert:post_images', values: [{ postId: POST, storagePath: myPath(1), position: 0 }] });
  });

  it('남은 사진 + 새 사진이 10장을 넘으면 거부', async () => {
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce(existing() as never);
    const nine = Array.from({ length: 9 }, (_, i) => `${ME}/${String(i + 10).padStart(8, '0')}-0000-4000-8000-000000000000.png`);
    expect(await updatePost(null, form({ id: POST, content: 'x', imagePaths: nine }))).toEqual({ error: '사진은 최대 10장까지 올릴 수 있습니다.' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('관리자는 남의 글도 고칠 수 있다(권한은 DB로 확인)', async () => {
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce(existing(OTHER) as never);
    vi.mocked(getAdminUser).mockResolvedValueOnce({ id: ME, isAdmin: true } as never);
    await updatePost(null, form({ id: POST, content: '정리' }));
    expect(writes[0]).toEqual({ op: 'update:posts', values: expect.objectContaining({ content: '정리' }) });
  });

  it('활동 기록은 활동 칼럼도 고치고, 사진은 activity_photos에서 다룬다. 종류는 바꿀 수 없다', async () => {
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce({ ...existing(), kind: 'activity' } as never);
    await updatePost(null, activityForm({ id: POST, kind: 'general', title: '고친 제목', removeImageIds: 'img-a', imagePaths: myPath(3) }));
    expect(writes[0]).toEqual({
      op: 'update:posts',
      values: expect.objectContaining({ content: '• 인원 8명', title: '고친 제목', activityType: 'REGULAR', activityDate: '2026-10-16', seasonId: 5 }),
    });
    expect(writes[0].values).not.toHaveProperty('kind');
    expect(getPostImageInfo).toHaveBeenCalledWith([myPath(3)], 'activity_photos');
    expect(removePostImages).toHaveBeenCalledWith([myPath(1)], 'activity_photos');
  });

  it('활동 기록 수정도 입력을 검사한다', async () => {
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce({ ...existing(), kind: 'activity' } as never);
    expect(await updatePost(null, activityForm({ id: POST, activityDate: '2026-02-30' }))).toEqual({ error: '모임 날짜를 확인해주세요.' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('사진을 모두 빼면 post_images를 비우기만 한다', async () => {
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce(existing() as never);
    await updatePost(null, form({ id: POST, content: 'x', removeImageIds: ['img-a', 'img-b'] }));
    expect(writes.map((w) => w.op)).toEqual(['update:posts', 'delete:post_images']);
    expect(removePostImages).toHaveBeenCalledWith([myPath(1), myPath(2)], 'post_images');
  });
});

describe('deletePost', () => {
  it('로그인 필요, 남의 글은 거부', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    await expect(deletePost(POST)).rejects.toThrow('로그인이 필요합니다.');
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce({ id: POST, authorId: OTHER, images: [] } as never);
    await expect(deletePost(POST)).rejects.toThrow('삭제 권한이 없습니다.');
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('관리자는 남의 활동 기록도 지우고, 사진은 activity_photos에서 지운다', async () => {
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce({
      id: POST, authorId: OTHER, kind: 'activity', images: [{ id: 'a', storagePath: 's4/a/0.jpg', position: 0 }],
    } as never);
    vi.mocked(getAdminUser).mockResolvedValueOnce({ id: ME, isAdmin: true } as never);
    const where = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValueOnce({ where } as never);
    await deletePost(POST);
    expect(where).toHaveBeenCalled();
    expect(removePostImages).toHaveBeenCalledWith(['s4/a/0.jpg'], 'activity_photos');
  });

  it('글을 지운 뒤 사진 파일도 Storage에서 지운다', async () => {
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce({
      id: POST, authorId: ME, images: [{ id: 'a', storagePath: myPath(1), position: 0 }],
    } as never);
    const where = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValueOnce({ where } as never);
    await deletePost(POST);
    expect(where).toHaveBeenCalled();
    expect(removePostImages).toHaveBeenCalledWith([myPath(1)], 'post_images');
  });
});

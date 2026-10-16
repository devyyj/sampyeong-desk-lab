import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/db';
import { getComments, getLikeSummaries } from './community';
import { getMemberBadges } from './member-badges';
import { createSignedPhotoUrls } from './storage-admin';
import { FEED_PAGE_SIZE, getActivityTypes, getFeedPage, getPostView } from './feed';
import { feedFilterHref, parseFeedFilter } from './feed-filter';

const groupBy = vi.fn();
vi.mock('@/db', () => ({
  db: {
    query: { posts: { findMany: vi.fn(), findFirst: vi.fn() } },
    select: vi.fn(() => ({ from: () => ({ where: () => ({ groupBy }) }) })),
  },
}));
vi.mock('./community', () => ({ getComments: vi.fn(), getLikeSummaries: vi.fn() }));
vi.mock('./member-badges', () => ({ getMemberBadges: vi.fn() }));
vi.mock('./storage-admin', () => ({ createSignedPhotoUrls: vi.fn() }));

const AUTHOR = 'a0000000-0000-4000-8000-000000000000';
const NOW = new Date('2026-10-17T03:00:00Z');

const general = {
  id: 'g1', authorId: AUTHOR, kind: 'general', title: null, activityType: null, seasonId: null, activityDate: null,
  content: '오늘 재밌었어요', createdAt: new Date('2026-10-17T02:30:00Z'),
  author: { id: AUTHOR, nickname: '보드왕', profileImageUrl: null },
  images: [{ storagePath: `${AUTHOR}/x.jpg` }],
  season: null,
};
const activity = {
  id: 'a1', authorId: AUTHOR, kind: 'activity', title: '제 7회 방탈출', activityType: 'ESCAPE_ROOM', seasonId: 4, activityDate: '2026-07-31',
  content: '• 테마', createdAt: new Date('2026-07-31T03:00:00Z'),
  author: { id: AUTHOR, nickname: '보드왕', profileImageUrl: null },
  images: [{ storagePath: 's4/a/0.jpg' }, { storagePath: 's4/a/1.jpg' }],
  season: { name: '시즌 4' },
};

describe('parseFeedFilter / feedFilterHref (피드 필터 칩 ↔ 주소)', () => {
  it('kind가 없거나 모르는 값이면 전체', () => {
    expect(parseFeedFilter({})).toEqual({ kind: 'all', type: null });
    expect(parseFeedFilter({ kind: 'xxx' })).toEqual({ kind: 'all', type: null });
  });
  it('활동 기록은 종류(입력한 이름)까지 고를 수 있다. 예전 코드는 이름으로, 너무 긴 값은 무시', () => {
    expect(parseFeedFilter({ kind: 'activity', type: '보드게임 카페' })).toEqual({ kind: 'activity', type: '보드게임 카페' });
    expect(parseFeedFilter({ kind: 'activity', type: 'LUNCH' })).toEqual({ kind: 'activity', type: '점심' });
    expect(parseFeedFilter({ kind: 'activity', type: '가'.repeat(21) })).toEqual({ kind: 'activity', type: null });
  });
  it('자유글에는 종류가 없다', () => {
    expect(parseFeedFilter({ kind: 'general', type: 'LUNCH' })).toEqual({ kind: 'general', type: null });
  });
  it('같은 키가 여러 번 오면 첫 값만 쓴다', () => {
    expect(parseFeedFilter({ kind: ['activity', 'general'] })).toEqual({ kind: 'activity', type: null });
  });
  it('필터를 주소로 되돌린다', () => {
    expect(feedFilterHref({ kind: 'all', type: null })).toBe('/');
    expect(feedFilterHref({ kind: 'general', type: null })).toBe('/?kind=general');
    expect(feedFilterHref({ kind: 'activity', type: '정기 모임' })).toBe('/?kind=activity&type=%EC%A0%95%EA%B8%B0+%EB%AA%A8%EC%9E%84');
  });
});

describe('getFeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMemberBadges).mockResolvedValue(new Map([[AUTHOR, { kind: 'president' as const }]]));
    vi.mocked(getLikeSummaries).mockResolvedValue(new Map([['a1', { count: 2, liked: true }]]));
    vi.mocked(getComments).mockResolvedValue(new Map());
    vi.mocked(createSignedPhotoUrls).mockResolvedValue(['https://signed/0', null]);
  });

  it('한 페이지(+다음 페이지 확인용 1건)를 최신순으로 가져온다', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([general, activity] as never);
    const page = await getFeedPage({ kind: 'all', type: null }, 20, null, NOW);
    expect(vi.mocked(db.query.posts.findMany).mock.calls[0][0]).toMatchObject({ limit: FEED_PAGE_SIZE + 1, offset: 20 });
    expect(page.hasMore).toBe(false);
    expect(page.items.map((i) => i.id)).toEqual(['g1', 'a1']);
  });

  it('한 페이지보다 많으면 hasMore이고 넘친 1건은 빼고, 좋아요·댓글도 그 페이지 글만 센다', async () => {
    const rows = Array.from({ length: FEED_PAGE_SIZE + 1 }, (_, i) => ({ ...general, id: `g${i}` }));
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce(rows as never);
    const page = await getFeedPage({ kind: 'general', type: null }, 0, null, NOW);
    expect(page.hasMore).toBe(true);
    expect(page.items).toHaveLength(FEED_PAGE_SIZE);
    expect(getLikeSummaries).toHaveBeenCalledWith('post', rows.slice(0, FEED_PAGE_SIZE).map((r) => r.id), null);
    // 댓글 작성일도 카드와 같은 기준 시각으로 계산한다.
    expect(getComments).toHaveBeenCalledWith('post', rows.slice(0, FEED_PAGE_SIZE).map((r) => r.id), null, NOW);
  });

  it('자유글 사진은 공개 URL, 작성 시각은 서버에서 상대 시간 문구로 만든다', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([general] as never);
    const [item] = (await getFeedPage({ kind: 'all', type: null }, 0, null, NOW)).items;
    expect(item.images).toEqual([{ src: expect.stringContaining(`/storage/v1/object/public/post_images/${AUTHOR}/x.jpg`), alt: '게시글 사진 1' }]);
    expect(item.photosLocked).toBe(false);
    expect(item.createdLabel).toBe('30분 전');
    expect(item.activity).toBeNull();
  });

  it('비회원에게는 활동 사진 URL을 발급하지 않고 장수만 알린다', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([activity] as never);
    const [item] = (await getFeedPage({ kind: 'activity', type: null }, 0, null, NOW)).items;
    expect(createSignedPhotoUrls).not.toHaveBeenCalled();
    expect(item.images).toEqual([]);
    expect(item.photoCount).toBe(2);
    expect(item.photosLocked).toBe(true);
    expect(item.activity).toEqual({ title: '제 7회 방탈출', type: 'ESCAPE_ROOM', seasonName: '시즌 4' });
    // 활동 기록의 날짜는 작성 시각이 아니라 모임 날짜 하나만, 같은 표기 규칙으로.
    expect(item.createdAt).toBe('2026-07-31');
    expect(item.createdLabel).toBe('7월 31일');
  });

  it('회원에게는 페이지의 활동 사진을 한 번에 서명하고, 실패한 사진은 뺀다', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([general, activity] as never);
    const page = await getFeedPage({ kind: 'all', type: null }, 0, { id: 'viewer', isAdmin: false }, NOW);
    expect(createSignedPhotoUrls).toHaveBeenCalledTimes(1);
    expect(createSignedPhotoUrls).toHaveBeenCalledWith(['s4/a/0.jpg', 's4/a/1.jpg']);
    const item = page.items[1];
    expect(item.images).toEqual([{ src: 'https://signed/0', alt: '제 7회 방탈출 사진 1' }]);
    expect(item.photosLocked).toBe(false);
    expect(item.liked).toBe(true);
    expect(item.likeCount).toBe(2);
  });

  it('수정·삭제 메뉴는 작성자 본인과 관리자에게만', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValue([general] as never);
    vi.mocked(createSignedPhotoUrls).mockResolvedValue([]);
    const as = async (viewer: { id: string; isAdmin: boolean } | null) =>
      (await getFeedPage({ kind: 'all', type: null }, 0, viewer, NOW)).items[0].canEdit;
    expect(await as(null)).toBe(false);
    expect(await as({ id: 'other', isAdmin: false })).toBe(false);
    expect(await as({ id: AUTHOR, isAdmin: false })).toBe(true);
    expect(await as({ id: 'admin', isAdmin: true })).toBe(true);
  });
});

describe('getPostView (상세)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMemberBadges).mockResolvedValue(new Map());
    vi.mocked(getLikeSummaries).mockResolvedValue(new Map());
    vi.mocked(getComments).mockResolvedValue(new Map());
  });

  it('없는 글이면 null', async () => {
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce(undefined as never);
    expect(await getPostView('a1', null, NOW)).toBeNull();
  });

  it('피드 카드와 같은 모양으로 한 건을 돌려준다', async () => {
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce(activity as never);
    const view = await getPostView('a1', null, NOW);
    expect(view).toMatchObject({ id: 'a1', photoCount: 2, photosLocked: true, activity: { title: '제 7회 방탈출' } });
  });
});

describe('getActivityTypes (피드 종류 칩)', () => {
  it('실제로 쓰인 종류를 많이 쓴 순(같으면 가나다순)으로, 예전 코드는 이름으로 합쳐 센다', async () => {
    groupBy.mockResolvedValueOnce([
      { type: '정기 모임', count: 3 },
      { type: 'ESCAPE_ROOM', count: 2 },
      { type: '방탈출', count: 2 },
      { type: '번개', count: 3 },
      { type: null, count: 1 },
    ]);
    expect(await getActivityTypes()).toEqual(['방탈출', '번개', '정기 모임']);
  });
});

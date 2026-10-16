import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/db';
import { getComments, getLikeSummaries } from './community';
import { getMemberBadges } from './member-badges';
import { createSignedPhotoUrls } from './storage-admin';
import { FEED_PAGE_SIZE, getFeedPage, getPostView } from './feed';
import { feedFilterHref, parseFeedFilter } from './feed-filter';

vi.mock('@/db', () => ({ db: { query: { posts: { findMany: vi.fn(), findFirst: vi.fn() } } } }));
vi.mock('./community', () => ({ getComments: vi.fn(), getLikeSummaries: vi.fn() }));
vi.mock('./member-badges', () => ({ getMemberBadges: vi.fn() }));
vi.mock('./storage-admin', () => ({ createSignedPhotoUrls: vi.fn() }));

const AUTHOR = 'a0000000-0000-4000-8000-000000000000';
const NOW = new Date('2026-10-17T03:00:00Z');

/** 선택 정보 없이 사진만 있는 글 */
const plain = {
  id: 'g1', authorId: AUTHOR, activityDate: null, tags: [],
  content: '오늘 재밌었어요', createdAt: new Date('2026-10-17T02:30:00Z'),
  author: { id: AUTHOR, nickname: '보드왕', profileImageUrl: null },
  images: [{ storagePath: `${AUTHOR}/x.jpg` }],
  season: null,
};
/** 태그·모임 날짜·시즌을 모두 입력한 글(이관된 활동 기록과 같은 모양) */
const meeting = {
  id: 'a1', authorId: AUTHOR, activityDate: '2026-07-31', tags: ['방탈출'],
  content: '제 7회 방탈출\n• 테마', createdAt: new Date('2026-07-31T03:00:00Z'),
  author: { id: AUTHOR, nickname: '보드왕', profileImageUrl: null },
  images: [{ storagePath: 's4/a/0.jpg' }, { storagePath: 's4/a/1.jpg' }],
  season: { name: '시즌 4' },
};

describe('parseFeedFilter / feedFilterHref (태그 모아 보기 ↔ 주소)', () => {
  it('태그가 없으면 전체. 예전 주소의 kind·type은 무시한다', () => {
    expect(parseFeedFilter({})).toEqual({ tag: null });
    expect(parseFeedFilter({ kind: 'activity', type: 'LUNCH' } as never)).toEqual({ tag: null });
  });
  it('태그는 정리해서 쓰고(앞의 # 제거), 잘못된 값은 무시한다', () => {
    expect(parseFeedFilter({ tag: '#방탈출' })).toEqual({ tag: '방탈출' });
    expect(parseFeedFilter({ tag: ['점심', '저녁'] })).toEqual({ tag: '점심' });
    expect(parseFeedFilter({ tag: '가'.repeat(21) })).toEqual({ tag: null });
  });
  it('필터를 주소로 되돌린다', () => {
    expect(feedFilterHref({ tag: null })).toBe('/');
    expect(feedFilterHref({ tag: '정기 모임' })).toBe('/?tag=%EC%A0%95%EA%B8%B0+%EB%AA%A8%EC%9E%84');
  });
});

describe('getFeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMemberBadges).mockResolvedValue(new Map([[AUTHOR, { kind: 'president' as const }]]));
    vi.mocked(getLikeSummaries).mockResolvedValue(new Map([['a1', { count: 2, liked: true }]]));
    vi.mocked(getComments).mockResolvedValue(new Map());
    vi.mocked(createSignedPhotoUrls).mockResolvedValue(['https://signed/x', 'https://signed/0', null]);
  });

  it('한 페이지(+다음 페이지 확인용 1건)를 최신순으로, 태그가 없으면 조건 없이 가져온다', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([plain, meeting] as never);
    const page = await getFeedPage({ tag: null }, 20, null, NOW);
    const query = vi.mocked(db.query.posts.findMany).mock.calls[0][0]!;
    expect(query).toMatchObject({ limit: FEED_PAGE_SIZE + 1, offset: 20 });
    expect(query.where).toBeUndefined();
    expect(page.hasMore).toBe(false);
    expect(page.items.map((i) => i.id)).toEqual(['g1', 'a1']);
  });

  it('태그로 모아 볼 때는 조건을 건다', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([] as never);
    await getFeedPage({ tag: '방탈출' }, 0, null, NOW);
    expect(vi.mocked(db.query.posts.findMany).mock.calls[0][0]!.where).toBeDefined();
  });

  it('한 페이지보다 많으면 hasMore이고 넘친 1건은 빼고, 좋아요·댓글도 그 페이지 글만 센다', async () => {
    const rows = Array.from({ length: FEED_PAGE_SIZE + 1 }, (_, i) => ({ ...plain, id: `g${i}` }));
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce(rows as never);
    const page = await getFeedPage({ tag: null }, 0, null, NOW);
    expect(page.hasMore).toBe(true);
    expect(page.items).toHaveLength(FEED_PAGE_SIZE);
    expect(getLikeSummaries).toHaveBeenCalledWith('post', rows.slice(0, FEED_PAGE_SIZE).map((r) => r.id), null);
    // 댓글 작성일도 카드와 같은 기준 시각으로 계산한다.
    expect(getComments).toHaveBeenCalledWith('post', rows.slice(0, FEED_PAGE_SIZE).map((r) => r.id), null, NOW);
  });

  it('선택 정보가 없으면 날짜는 작성 시각, 시즌·태그는 비어 있다', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([plain] as never);
    const [item] = (await getFeedPage({ tag: null }, 0, null, NOW)).items;
    expect(item.createdLabel).toBe('30분 전');
    expect(item.seasonName).toBeNull();
    expect(item.meetingDate).toBeNull();
    expect(item.meetingDateLabel).toBeNull();
    expect(item.tags).toEqual([]);
  });

  it('모임 날짜를 입력했으면 날짜는 모임 날짜 하나만, 시즌·태그도 싣는다', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([meeting] as never);
    const [item] = (await getFeedPage({ tag: null }, 0, null, NOW)).items;
    expect(item.createdAt).toBe('2026-07-31');
    expect(item.createdLabel).toBe('7월 31일');
    expect(item.seasonName).toBe('시즌 4');
    // 모임 날짜는 머리줄 날짜와 별도로 본문에 분명하게 적는다.
    expect(item.meetingDate).toBe('2026-07-31');
    expect(item.meetingDateLabel).toBe('2026년 7월 31일 (금)');
    expect(item.tags).toEqual(['방탈출']);
  });

  it('비회원에게는 어떤 글이든 사진 URL을 발급하지 않고 장수만 알린다', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([plain, meeting] as never);
    const items = (await getFeedPage({ tag: null }, 0, null, NOW)).items;
    expect(createSignedPhotoUrls).not.toHaveBeenCalled();
    expect(items.map((i) => [i.images, i.photoCount, i.photosLocked])).toEqual([
      [[], 1, true],
      [[], 2, true],
    ]);
  });

  it('회원에게는 페이지의 모든 사진을 한 번에 서명하고, 실패한 사진은 뺀다', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValueOnce([plain, meeting] as never);
    const page = await getFeedPage({ tag: null }, 0, { id: 'viewer', isAdmin: false }, NOW);
    expect(createSignedPhotoUrls).toHaveBeenCalledTimes(1);
    expect(createSignedPhotoUrls).toHaveBeenCalledWith([`${AUTHOR}/x.jpg`, 's4/a/0.jpg', 's4/a/1.jpg']);
    expect(page.items[0].images).toEqual([{ src: 'https://signed/x', alt: '게시글 사진 1' }]);
    expect(page.items[1].images).toEqual([{ src: 'https://signed/0', alt: '게시글 사진 1' }]);
    expect(page.items[1].photosLocked).toBe(false);
    expect(page.items[1].liked).toBe(true);
    expect(page.items[1].likeCount).toBe(2);
  });

  it('수정·삭제 메뉴는 작성자 본인과 관리자에게만', async () => {
    vi.mocked(db.query.posts.findMany).mockResolvedValue([{ ...plain, images: [] }] as never);
    const as = async (viewer: { id: string; isAdmin: boolean } | null) => (await getFeedPage({ tag: null }, 0, viewer, NOW)).items[0].canEdit;
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
    vi.mocked(db.query.posts.findFirst).mockResolvedValueOnce(meeting as never);
    expect(await getPostView('a1', null, NOW)).toMatchObject({ id: 'a1', photoCount: 2, photosLocked: true, tags: ['방탈출'] });
  });
});

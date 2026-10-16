// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildMergePlan, findPresident, type MergeSource } from './plan';

const ACT = '11111111-1111-4111-8111-111111111111';
const PRES = '99999999-9999-4999-8999-999999999999';

const source = (o: Partial<MergeSource> = {}): MergeSource => ({
  activities: [
    {
      id: ACT,
      seasonId: 4,
      date: '2026-07-31',
      type: 'ESCAPE_ROOM',
      title: '제 7회 방탈출 정기모임',
      bodyMd: '- **제 7회 방탈출 정기모임**\n    - 테마\n        - 강남던전',
      noteMd: '- 재밌었다',
      sourceKey: '1349016580:7',
      createdAt: new Date('2026-10-15T12:00:00Z'),
    },
  ],
  photos: [
    { activityId: ACT, storagePath: 's4/a/2.jpg', position: 1 },
    { activityId: ACT, storagePath: 's4/a/1.jpg', position: 0 },
  ],
  likes: [{ activityId: ACT, userId: 'u1', createdAt: new Date('2026-10-16T00:00:00Z') }],
  activityCommentIds: ['c1'],
  ...o,
});

describe('buildMergePlan (activities → posts)', () => {
  it('활동 1건을 같은 id의 활동형 게시글로 옮긴다(작성자 = 회장, 본문은 일반 텍스트로 변환)', () => {
    const plan = buildMergePlan(source(), PRES);
    expect(plan.posts).toEqual([
      {
        id: ACT,
        authorId: PRES,
        kind: 'activity',
        title: '제 7회 방탈출 정기모임',
        activityType: '방탈출',
        seasonId: 4,
        activityDate: '2026-07-31',
        sourceKey: '1349016580:7',
        content: '• 테마\n   ◦ 강남던전\n\n─── 후기 ───\n• 재밌었다',
        // 피드에서 시간순으로 읽히도록 모임 날짜 정오(KST)를 작성 시각으로 둔다.
        createdAt: new Date('2026-07-31T03:00:00Z'),
        updatedAt: new Date('2026-10-15T12:00:00Z'),
      },
    ]);
  });

  it('사진은 파일을 옮기지 않고 같은 경로·순서로 post_images 행만 만든다', () => {
    const plan = buildMergePlan(source(), PRES);
    expect(plan.postImages).toEqual([
      { postId: ACT, storagePath: 's4/a/1.jpg', position: 0 },
      { postId: ACT, storagePath: 's4/a/2.jpg', position: 1 },
    ]);
  });

  it('활동 좋아요는 게시글 좋아요로, 활동 댓글은 게시글 댓글로 옮길 목록을 만든다', () => {
    const plan = buildMergePlan(source(), PRES);
    expect(plan.postLikes).toEqual([{ postId: ACT, userId: 'u1', createdAt: new Date('2026-10-16T00:00:00Z') }]);
    expect(plan.commentIds).toEqual(['c1']);
  });

  it('요약 수치(보고서·검증용)', () => {
    expect(buildMergePlan(source(), PRES).summary).toEqual({ posts: 1, images: 2, likes: 1, comments: 1 });
  });

  it('후기가 없으면 구분선 없이 본문만', () => {
    const src = source();
    src.activities[0].noteMd = null;
    expect(buildMergePlan(src, PRES).posts[0].content).toBe('• 테마\n   ◦ 강남던전');
  });
});

describe('findPresident (기존 활동의 작성자)', () => {
  it('최신 시즌의 회장을 고른다', () => {
    expect(
      findPresident([
        { seasonId: 3, userId: 'old', role: '회장' },
        { seasonId: 5, userId: PRES, role: '회장' },
        { seasonId: 5, userId: 'x', role: null },
      ]),
    ).toBe(PRES);
  });

  it('최신 시즌 회장이 없거나 여러 명이면 멈춘다(잘못된 작성자로 91건을 쓰지 않게)', () => {
    expect(() => findPresident([{ seasonId: 5, userId: 'x', role: null }])).toThrow('회장');
    expect(() =>
      findPresident([
        { seasonId: 5, userId: 'a', role: '회장' },
        { seasonId: 5, userId: 'b', role: '회장' },
      ]),
    ).toThrow('회장');
  });
});

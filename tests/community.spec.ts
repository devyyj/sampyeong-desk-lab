import { test, expect, type Page } from '@playwright/test';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { cleanupE2EData, createTestUser, db, loggedInPage, type TestUser } from './helpers';
import { commentLikes, comments, postLikes, posts } from '../drizzle/schema';

/**
 * 좋아요·댓글 E2E(실제 DB). 게시글(자유글·활동 기록)·댓글 좋아요 토글이 새로고침 후에도 유지되는지,
 * 댓글 작성·수정·삭제와 권한(본인/타 회원/관리자/비회원)이 화면과 DB 모두에서 지켜지는지 본다.
 * 테스트 회원이 남긴 좋아요·댓글은 회원 삭제(cleanup) 때 FK cascade로 함께 지워진다.
 */
let writer: TestUser;
let fan: TestUser;
let admin: TestUser;

test.beforeAll(async () => {
  writer = await createTestUser('cwrite');
  fan = await createTestUser('cfan');
  admin = await createTestUser('cadmin', { isAdmin: true });
});

test.afterAll(cleanupE2EData);

const postCard = (page: Page, content: string) => page.locator('article').filter({ hasText: content });
// 피드 댓글은 카드 안에 펼치지 않고 바텀시트(document.body로 포털)로 연다.
const commentsSheet = (page: Page) => page.getByRole('dialog', { name: '댓글' });

test('게시글: 좋아요 토글·유지, 댓글 작성·수정·좋아요·삭제와 권한', async ({ browser }) => {
  test.setTimeout(90_000);
  const content = `E2E 반응 글 ${Date.now()}`;
  const [post] = await db.insert(posts).values({ authorId: writer.id, content }).returning({ id: posts.id });

  // 회원: 좋아요 → 새로고침 후에도 유지 → 취소
  const page = await loggedInPage(browser, fan, '/');
  const card = postCard(page, content);
  await card.getByRole('button', { name: '좋아요 0' }).click();
  await expect(card.getByRole('button', { name: '좋아요 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await db.select().from(postLikes).where(eq(postLikes.postId, post.id))).length).toBe(1);
  await page.reload();
  await expect(card.getByRole('button', { name: '좋아요 1' })).toHaveAttribute('aria-pressed', 'true');
  await card.getByRole('button', { name: '좋아요 1' }).click();
  await expect(card.getByRole('button', { name: '좋아요 0' })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await db.select().from(postLikes).where(eq(postLikes.postId, post.id))).length).toBe(0);

  // 댓글: 💬를 누르면 댓글 시트가 열린다
  await card.getByRole('button', { name: '댓글 0', exact: true }).click();
  await commentsSheet(page).getByRole('textbox', { name: '댓글 쓰기' }).fill('E2E 첫 댓글');
  await commentsSheet(page).getByRole('button', { name: '댓글 달기' }).click();
  const myComment = commentsSheet(page).getByRole('listitem').filter({ hasText: 'E2E 첫 댓글' });
  await expect(myComment).toBeVisible();
  await expect(myComment.getByRole('button', { name: fan.username })).toBeVisible();
  await expect(commentsSheet(page).getByRole('textbox', { name: '댓글 쓰기' })).toHaveValue('');
  await expect(card.getByRole('button', { name: '댓글 1', exact: true })).toBeVisible();
  const [saved] = await db.select().from(comments).where(eq(comments.postId, post.id));
  expect(saved).toMatchObject({ authorId: fan.id, content: 'E2E 첫 댓글', activityId: null });

  // 수정 → (수정됨)
  await myComment.getByRole('button', { name: '수정' }).click();
  await commentsSheet(page).getByRole('textbox', { name: '댓글 수정' }).fill('E2E 고친 댓글');
  await commentsSheet(page).getByRole('button', { name: '저장' }).click();
  const edited = commentsSheet(page).getByRole('listitem').filter({ hasText: 'E2E 고친 댓글' });
  await expect(edited).toContainText('(수정됨)');

  // 댓글 좋아요 → 새로고침 후 유지
  await edited.getByRole('button', { name: '좋아요 0' }).click();
  await expect(edited.getByRole('button', { name: '좋아요 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await db.select().from(commentLikes).where(eq(commentLikes.commentId, saved.id))).length).toBe(1);
  await page.reload();
  await card.getByRole('button', { name: '댓글 1', exact: true }).click();
  await expect(commentsSheet(page).getByRole('listitem').filter({ hasText: 'E2E 고친 댓글' }).getByRole('button', { name: '좋아요 1' }))
    .toHaveAttribute('aria-pressed', 'true');

  // 다른 회원(작성자): 남의 댓글에는 수정·삭제 버튼이 없다. 자기 댓글을 단다.
  const writerPage = await loggedInPage(browser, writer, '/');
  const writerCard = postCard(writerPage, content);
  await writerCard.getByRole('button', { name: '댓글 1', exact: true }).click();
  const fansComment = commentsSheet(writerPage).getByRole('listitem').filter({ hasText: 'E2E 고친 댓글' });
  await expect(fansComment.getByRole('button', { name: '수정' })).toHaveCount(0);
  await expect(fansComment.getByRole('button', { name: '삭제' })).toHaveCount(0);
  await commentsSheet(writerPage).getByRole('textbox', { name: '댓글 쓰기' }).fill('E2E 작성자 댓글');
  await commentsSheet(writerPage).getByRole('button', { name: '댓글 달기' }).click();
  await expect(commentsSheet(writerPage).getByRole('listitem').filter({ hasText: 'E2E 작성자 댓글' })).toBeVisible();

  // 관리자: 남의 댓글은 삭제만 가능(수정 버튼 없음)
  const adminPage = await loggedInPage(browser, admin, '/');
  const adminCard = postCard(adminPage, content);
  await adminCard.getByRole('button', { name: '댓글 2', exact: true }).click();
  const target = commentsSheet(adminPage).getByRole('listitem').filter({ hasText: 'E2E 작성자 댓글' });
  await expect(target.getByRole('button', { name: '수정' })).toHaveCount(0);
  adminPage.once('dialog', (d) => d.accept());
  await target.getByRole('button', { name: '삭제' }).click();
  await expect(commentsSheet(adminPage).getByRole('listitem').filter({ hasText: 'E2E 작성자 댓글' })).toHaveCount(0);
  await expect.poll(async () => (await db.select().from(comments).where(eq(comments.authorId, writer.id))).length).toBe(0);

  // 비회원: 수는 보이지만 좋아요는 로그인 안내, 댓글 작성 폼 없음
  const guest = await browser.newPage();
  await guest.goto('/');
  const guestCard = postCard(guest, content);
  await guestCard.getByRole('button', { name: '좋아요 0' }).click();
  await expect(guestCard.getByRole('alert')).toHaveText('로그인하면 좋아요를 누를 수 있습니다.');
  await guestCard.getByRole('button', { name: '댓글 1', exact: true }).click();
  await expect(commentsSheet(guest).getByText('E2E 고친 댓글')).toBeVisible();
  await expect(commentsSheet(guest).getByRole('textbox')).toHaveCount(0);
  await expect(commentsSheet(guest).getByRole('button', { name: '삭제' })).toHaveCount(0);

  // 본인 댓글 삭제 → 댓글 좋아요도 cascade로 사라진다.
  await page.reload();
  await card.getByRole('button', { name: '댓글 1', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await commentsSheet(page).getByRole('listitem').filter({ hasText: 'E2E 고친 댓글' }).getByRole('button', { name: '삭제' }).click();
  await expect(card.getByRole('button', { name: '댓글 0', exact: true })).toBeVisible();
  expect(await db.select().from(commentLikes).where(eq(commentLikes.commentId, saved.id))).toHaveLength(0);

  await Promise.all([page.context().close(), writerPage.context().close(), adminPage.context().close(), guest.close()]);
});

test('활동 기록: 상세에서 좋아요·댓글, 피드 카드에 좋아요·댓글 수 표시', async ({ browser }) => {
  // 이관된 활동 중 가장 최근 것(피드의 활동 기록 첫 페이지에 나온다). 테스트 회원의 반응은 정리 때 cascade로 지워진다.
  const [activity] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.kind, 'activity'), isNotNull(posts.sourceKey)))
    .orderBy(desc(posts.createdAt), posts.id)
    .limit(1);
  const before = (await db.select().from(postLikes).where(eq(postLikes.postId, activity.id))).length;

  const page = await loggedInPage(browser, fan, `/posts/${activity.id}`);
  // 상세에서는 댓글 영역이 항상 펼쳐져 있다.
  await expect(page.getByRole('textbox', { name: '댓글 쓰기' })).toBeVisible();
  // 실제 데이터의 댓글에도 같은 개수의 좋아요 버튼이 있을 수 있어, 댓글 영역 밖의 글 좋아요 버튼만 고른다.
  const activityLike = page.getByRole('button', { name: /^좋아요 \d+$/ }).and(page.locator(':not([aria-label="댓글"] *)')).first();
  await expect(activityLike).toHaveAccessibleName(`좋아요 ${before}`);
  await activityLike.click();
  await expect(activityLike).toHaveAccessibleName(`좋아요 ${before + 1}`);
  await expect(activityLike).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () =>
    (await db.select().from(postLikes).where(and(eq(postLikes.postId, activity.id), eq(postLikes.userId, fan.id)))).length,
  ).toBe(1);

  await page.getByRole('textbox', { name: '댓글 쓰기' }).fill('E2E 활동 댓글');
  await page.getByRole('button', { name: '댓글 달기' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'E2E 활동 댓글' })).toBeVisible();
  const commentCount = (await db.select().from(comments).where(eq(comments.postId, activity.id))).length;
  await expect(page.getByRole('heading', { name: `댓글 ${commentCount}` })).toBeVisible();

  await page.reload();
  await expect(activityLike).toHaveAccessibleName(`좋아요 ${before + 1}`);
  await expect(activityLike).toHaveAttribute('aria-pressed', 'true');

  // 피드의 활동 기록 첫 페이지, 그 활동 카드에 좋아요·댓글 수가 보인다.
  await page.goto('/?kind=activity');
  const card = page.locator('article').filter({ has: page.getByRole('link', { name: activity.title!, exact: true }) });
  await expect(card.getByRole('button', { name: `좋아요 ${before + 1}` })).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByRole('button', { name: `댓글 ${commentCount}`, exact: true })).toBeVisible();

  // 비회원: 상세의 댓글은 보이지만 작성 폼 대신 로그인 안내
  const guest = await browser.newPage();
  await guest.goto(`/posts/${activity.id}`);
  await expect(guest.getByText('E2E 활동 댓글')).toBeVisible();
  await expect(guest.getByRole('textbox', { name: '댓글 쓰기' })).toHaveCount(0);
  await expect(guest.getByText(/하면 댓글을 쓸 수 있습니다/)).toBeVisible();

  await Promise.all([page.context().close(), guest.close()]);
});

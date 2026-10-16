import { test, expect } from '@playwright/test';
import { asc, eq } from 'drizzle-orm';
import {
  cleanupE2EData, createTestUser, db, expectImageLoaded, loggedInPage, storageFileExists, TEST_IMAGE, type TestUser,
} from './helpers';
import { postImages, posts } from '../drizzle/schema';

/**
 * 활동 기록 작성·권한 E2E(설계 §7). 회원이 실제 사진 파일을 첨부해 활동 기록을 쓰면
 * 사진이 비공개 버킷(activity_photos)에 올라가고, 회원에게는 signed URL로 보이며 비회원에게는 장수 안내만 보이는지,
 * 작성자·관리자만 수정·삭제할 수 있고 삭제하면 Storage 파일도 지워지는지까지 실제 DB·Storage로 본다(AGENTS.md 5·6번).
 */
let author: TestUser;
let other: TestUser;
let admin: TestUser;

test.beforeAll(async () => {
  author = await createTestUser('actw');
  other = await createTestUser('actr');
  admin = await createTestUser('acta', { isAdmin: true });
});

test.afterAll(cleanupE2EData);

const imagesOf = (postId: string) => db.select().from(postImages).where(eq(postImages.postId, postId)).orderBy(asc(postImages.position));

test('활동 기록: 사진 첨부 작성 → 회원은 signed URL 사진, 비회원은 안내 → 작성자 수정 → 타인 불가 → 관리자 삭제', async ({ browser }) => {
  test.setTimeout(120_000);
  const title = `E2E 정기모임 ${Date.now()}`;
  const edited = `${title} (수정)`;

  // 작성: ＋ → 종류 "활동 기록" → 제목·종류(날짜·시즌은 기본값) → 사진 → 게시
  const page = await loggedInPage(browser, author);
  await page.getByRole('link', { name: '글쓰기' }).click();
  await page.waitForURL('**/posts/write');
  await page.getByRole('radiogroup', { name: '글 종류' }).getByText('활동 기록').click();
  await page.getByLabel('제목').fill(title);
  // 종류는 글자로 입력한다. 예시 칩을 누르면 채워지고, 직접 쓴 글자도 그대로 저장된다.
  await page.getByRole('button', { name: '정기 모임' }).click();
  await expect(page.getByRole('textbox', { name: '활동 종류' })).toHaveValue('정기 모임');
  await page.getByRole('textbox', { name: '활동 종류' }).fill('정기 모임 번개');
  await page.getByLabel(/내용/).fill('• 인원 : 6명\n• 게임 : 스컬킹');
  await page.getByLabel('사진 첨부 (선택)').setInputFiles(TEST_IMAGE);
  await expect(page.getByRole('group', { name: '새 사진' }).getByRole('img')).toHaveCount(1);
  await page.getByRole('button', { name: '게시하기' }).click();
  await page.waitForURL((url) => url.pathname === '/');

  // DB: 활동 칼럼이 채워진 활동형 게시글, 사진은 activity_photos(비공개)에만 있다.
  const [row] = await db.select().from(posts).where(eq(posts.title, title));
  expect(row).toMatchObject({ authorId: author.id, kind: 'activity', activityType: '정기 모임 번개' });
  expect(row.seasonId).not.toBeNull();
  expect(row.activityDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const [photo] = await imagesOf(row.id);
  expect(photo.storagePath).toMatch(new RegExp(`^${author.id}/[0-9a-f-]{36}\\.png$`));
  expect(await storageFileExists('activity_photos', photo.storagePath)).toBe(true);
  expect(await storageFileExists('post_images', photo.storagePath)).toBe(false);

  // 피드 맨 위 카드: 종류 배지·굵은 제목, 사진은 signed URL로 실제 로드된다.
  const card = page.locator('article').filter({ has: page.getByRole('link', { name: title, exact: true }) });
  await expect(card).toContainText('정기 모임 번개');
  const img = card.getByRole('region', { name: '사진 1장' }).locator('img');
  await expect(img).toHaveAttribute('src', /\/storage\/v1\/object\/sign\/activity_photos\//);
  await expectImageLoaded(img);

  // 비회원: 상세에서 본문은 보이지만 사진은 장수 안내만, HTML에 서명 주소가 없다.
  const guest = await browser.newPage();
  await guest.goto(`/posts/${row.id}`);
  await expect(guest.getByRole('heading', { name: title })).toBeVisible();
  await expect(guest.getByText('로그인하면 사진 1장을 볼 수 있어요')).toBeVisible();
  expect(await guest.content()).not.toContain('/storage/v1/object/sign/activity_photos');

  // 작성자 수정: 종류는 바꿀 수 없고 활동 칸이 채워져 있다. 제목을 고친다.
  await card.getByRole('button', { name: '게시글 메뉴' }).click();
  await page.getByRole('dialog', { name: '게시글' }).getByRole('link', { name: '수정' }).click();
  await page.waitForURL(`**/posts/${row.id}/edit`);
  await expect(page.getByRole('radiogroup', { name: '글 종류' })).toHaveCount(0);
  await expect(page.getByLabel('제목')).toHaveValue(title);
  // 기존 사진 미리보기도 signed URL로 실제 로드된다.
  await expectImageLoaded(page.getByRole('img', { name: '기존 사진 1' }));
  await page.getByLabel('제목').fill(edited);
  await page.getByRole('button', { name: '수정완료' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await expect.poll(async () => (await db.select().from(posts).where(eq(posts.id, row.id)))[0].title).toBe(edited);

  // 다른 회원: 메뉴가 없고, 수정 주소로 직접 가도 피드로 돌려보낸다.
  const otherPage = await loggedInPage(browser, other, `/posts/${row.id}`);
  await expect(otherPage.getByRole('heading', { name: edited })).toBeVisible();
  await expect(otherPage.getByRole('button', { name: '게시글 메뉴' })).toHaveCount(0);
  await otherPage.goto(`/posts/${row.id}/edit`);
  await expect(otherPage).toHaveURL('/');

  // 관리자: 남의 활동 기록을 상세에서 삭제 → 피드로 돌아가고, DB 행과 Storage 사진이 지워진다.
  const adminPage = await loggedInPage(browser, admin, `/posts/${row.id}`);
  adminPage.once('dialog', (dialog) => dialog.accept());
  await adminPage.getByRole('button', { name: '게시글 메뉴' }).click();
  await adminPage.getByRole('dialog', { name: '게시글' }).getByRole('button', { name: '삭제' }).click();
  await adminPage.waitForURL((url) => url.pathname === '/');
  await expect.poll(async () => (await db.select().from(posts).where(eq(posts.id, row.id))).length).toBe(0);
  await expect.poll(() => storageFileExists('activity_photos', photo.storagePath)).toBe(false);

  await Promise.all([page.context().close(), otherPage.context().close(), adminPage.context().close(), guest.close()]);
});

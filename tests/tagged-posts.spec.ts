import { test, expect } from '@playwright/test';
import { asc, desc, eq } from 'drizzle-orm';
import {
  cleanupE2EData, createTestUser, db, expectImageLoaded, loggedInPage, storageFileExists, TEST_IMAGE, type TestUser,
} from './helpers';
import { postImages, posts, seasons } from '../drizzle/schema';

/**
 * 통합 양식 E2E(설계: 2026-10-17-unified-post-form-design.md §5). 사진 + 내용에 선택 정보(태그·모임 날짜·시즌)를 붙여 쓰면
 * 사진이 비공개 버킷에 올라가 회원에게만 보이고, 카드에 시즌·태그가 보이며, 태그를 눌러 모아 볼 수 있는지,
 * 수정에서 선택 정보를 비우면 카드에서도 사라지는지, 작성자·관리자만 수정·삭제할 수 있는지를 실제 DB·Storage로 본다.
 */
let author: TestUser;
let other: TestUser;
let admin: TestUser;

test.beforeAll(async () => {
  author = await createTestUser('tagw');
  other = await createTestUser('tagr');
  admin = await createTestUser('taga', { isAdmin: true });
});

test.afterAll(cleanupE2EData);

const imagesOf = (postId: string) => db.select().from(postImages).where(eq(postImages.postId, postId)).orderBy(asc(postImages.position));

test('태그·날짜·시즌 글: 작성 → 카드·태그 모아 보기 → 비회원 잠금 → 선택 정보 비우기 → 타인 불가 → 관리자 삭제', async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const content = `E2E 정기모임 ${stamp}\n• 인원 : 6명`;
  // 다른 글과 섞이지 않게 이 테스트만의 태그를 하나 단다.
  const uniqueTag = `e2e${stamp}`;
  const [latestSeason] = await db.select().from(seasons).orderBy(desc(seasons.id));

  // 작성: 양식은 하나(종류 전환·제목 없음). 사진 → 내용 → 태그(예시 칩 + 직접 입력) → 날짜 → 시즌
  const page = await loggedInPage(browser, author);
  await page.getByRole('link', { name: '글쓰기' }).click();
  await page.waitForURL('**/posts/write');
  await expect(page.getByRole('radiogroup', { name: '글 종류' })).toHaveCount(0);
  await page.getByLabel('사진 첨부 (선택)').setInputFiles(TEST_IMAGE);
  await page.getByLabel(/내용/).fill(content);
  await page.getByRole('button', { name: '#정기 모임' }).click();
  const tagBox = page.getByRole('textbox', { name: /태그/ });
  await tagBox.fill(uniqueTag);
  await tagBox.press('Enter');
  await expect(page.getByRole('button', { name: `#${uniqueTag} 빼기` })).toBeVisible();
  await page.getByLabel(/모임 날짜/).fill('2026-10-16');
  await page.getByLabel(/시즌/).selectOption(String(latestSeason.id));
  await page.getByRole('button', { name: '게시하기' }).click();
  await page.waitForURL((url) => url.pathname === '/');

  // DB: 선택 정보가 저장되고, 사진은 비공개 버킷(activity_photos)에 있다.
  const [row] = await db.select().from(posts).where(eq(posts.content, content));
  expect(row).toMatchObject({ authorId: author.id, tags: ['정기 모임', uniqueTag], activityDate: '2026-10-16', seasonId: latestSeason.id });
  const [photo] = await imagesOf(row.id);
  expect(photo.storagePath).toMatch(new RegExp(`^${author.id}/[0-9a-f-]{36}\\.png$`));
  expect(await storageFileExists('activity_photos', photo.storagePath)).toBe(true);

  // 카드: 날짜는 모임 날짜 하나, 시즌 칩, 태그, 사진은 signed URL로 실제 로드.
  const card = page.locator('article').filter({ hasText: `E2E 정기모임 ${stamp}` });
  await expect(card.locator('time')).toHaveCount(1);
  await expect(card.locator('time')).toHaveAttribute('dateTime', '2026-10-16');
  await expect(card.getByText(latestSeason.name, { exact: true })).toBeVisible();
  const img = card.getByRole('region', { name: '사진 1장' }).locator('img');
  await expect(img).toHaveAttribute('src', /\/storage\/v1\/object\/sign\/activity_photos\//);
  await expectImageLoaded(img);

  // 태그를 누르면 그 태그 글만 모인다(이 테스트만의 태그라 이 글 하나).
  await card.getByRole('link', { name: `#${uniqueTag}` }).click();
  await page.waitForURL((url) => url.searchParams.get('tag') === uniqueTag);
  await expect(page.getByRole('heading', { level: 1, name: `#${uniqueTag}` })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(1);

  // 비회원: 상세에서 본문은 보이지만 사진은 장수 안내만, HTML에 서명 주소가 없다.
  const guest = await browser.newPage();
  await guest.goto(`/posts/${row.id}`);
  await expect(guest.getByText(`E2E 정기모임 ${stamp}`)).toBeVisible();
  await expect(guest.getByText('로그인하면 사진 1장을 볼 수 있어요')).toBeVisible();
  expect(await guest.content()).not.toContain('/storage/v1/object/sign/');

  // 작성자 수정: 같은 양식에 값이 채워져 있다. 태그 하나를 빼고 날짜·시즌을 비운다.
  await page.goto(`/posts/${row.id}/edit`);
  await expect(page.getByRole('button', { name: '#정기 모임 빼기' })).toBeVisible();
  await expect(page.getByLabel(/모임 날짜/)).toHaveValue('2026-10-16');
  await expectImageLoaded(page.getByRole('img', { name: '기존 사진 1' }));
  await page.getByRole('button', { name: '#정기 모임 빼기' }).click();
  await page.getByLabel(/모임 날짜/).fill('');
  await page.getByLabel(/시즌/).selectOption('');
  await page.getByRole('button', { name: '수정완료' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await expect.poll(async () => (await db.select().from(posts).where(eq(posts.id, row.id)))[0]).toMatchObject({
    tags: [uniqueTag],
    activityDate: null,
    seasonId: null,
  });
  // 비운 정보는 카드에서도 사라진다(날짜는 작성 시각으로).
  const edited = page.locator('article').filter({ hasText: `E2E 정기모임 ${stamp}` });
  await expect(edited.getByText(latestSeason.name, { exact: true })).toHaveCount(0);
  await expect(edited.getByRole('link', { name: '#정기 모임' })).toHaveCount(0);
  await expect(edited.locator('time')).not.toHaveAttribute('dateTime', '2026-10-16');

  // 다른 회원: 메뉴가 없고, 수정 주소로 직접 가도 피드로 돌려보낸다.
  const otherPage = await loggedInPage(browser, other, `/posts/${row.id}`);
  await expect(otherPage.getByText(`E2E 정기모임 ${stamp}`)).toBeVisible();
  await expect(otherPage.getByRole('button', { name: '게시글 메뉴' })).toHaveCount(0);
  await otherPage.goto(`/posts/${row.id}/edit`);
  await expect(otherPage).toHaveURL('/');

  // 관리자: 남의 글을 상세에서 삭제 → 피드로 돌아가고, DB 행과 Storage 사진이 지워진다.
  const adminPage = await loggedInPage(browser, admin, `/posts/${row.id}`);
  adminPage.once('dialog', (dialog) => dialog.accept());
  await adminPage.getByRole('button', { name: '게시글 메뉴' }).click();
  await adminPage.getByRole('dialog', { name: '게시글' }).getByRole('button', { name: '삭제' }).click();
  await adminPage.waitForURL((url) => url.pathname === '/');
  await expect.poll(async () => (await db.select().from(posts).where(eq(posts.id, row.id))).length).toBe(0);
  await expect.poll(() => storageFileExists('activity_photos', photo.storagePath)).toBe(false);

  await Promise.all([page.context().close(), otherPage.context().close(), adminPage.context().close(), guest.close()]);
});

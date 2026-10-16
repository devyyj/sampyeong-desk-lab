import { test, expect } from '@playwright/test';
import { asc, eq } from 'drizzle-orm';
import {
  cleanupE2EData, createTestUser, db, expectImageLoaded, loggedInPage, storageFileExists, TEST_IMAGE, type TestUser,
} from './helpers';
import { posts, postImages } from '../drizzle/schema';

/**
 * 자유게시판 E2E. 사진은 실제 파일을 첨부해 브라우저가 서명 업로드 URL로 Supabase Storage(post_images)에
 * 직접 올리고, 피드에서 공개 URL 이미지가 실제로 로드되는지, 수정·삭제 때 Storage 파일이 정리되는지까지 본다
 * (AGENTS.md 5번).
 */
let author: TestUser;
let other: TestUser;

test.beforeAll(async () => {
  author = await createTestUser('writer');
  other = await createTestUser('reader');
});

test.afterAll(cleanupE2EData);

const imagesOf = (postId: string) =>
  db.select().from(postImages).where(eq(postImages.postId, postId)).orderBy(asc(postImages.position));

test('게시글: 사진 3장 작성 → 수정(1장 삭제·1장 추가) → 다른 회원은 수정·삭제 불가 → 작성자 삭제', async ({ browser }) => {
  test.setTimeout(90_000);
  const content = `E2E 게시글 ${Date.now()}`;
  const updated = `${content} (수정됨)`;

  const page = await loggedInPage(browser, author);
  await page.getByRole('link', { name: '글쓰기' }).click();
  await page.waitForURL('**/posts/write');

  // 내용 없이 제출하면 브라우저 required 검증에 막혀 이동하지 않는다.
  await page.getByRole('button', { name: '게시하기' }).click();
  await expect(page).toHaveURL(/\/posts\/write$/);

  await page.getByLabel(/내용/).fill(content);
  await page.getByLabel('사진 첨부 (선택)').setInputFiles([TEST_IMAGE, TEST_IMAGE, TEST_IMAGE]);
  // 고르는 즉시 미리보기가 보인다.
  await expect(page.getByRole('group', { name: '새 사진' }).getByRole('img')).toHaveCount(3);
  await expect(page.getByText('사진 3 / 10장')).toBeVisible();
  await page.getByRole('button', { name: '게시하기' }).click();
  await page.waitForURL((url) => url.pathname === '/');

  // 최신 글이 맨 위에 작성자 닉네임과 함께 보인다.
  const firstPost = page.locator('article').first();
  await expect(firstPost).toContainText(content);
  await expect(firstPost.getByRole('button', { name: author.username })).toBeVisible();

  const [row] = await db.select().from(posts).where(eq(posts.content, content));
  expect(row.authorId).toBe(author.id);
  const created = await imagesOf(row.id);
  expect(created.map((img) => img.position)).toEqual([0, 1, 2]);
  for (const img of created) {
    expect(img.storagePath).toMatch(new RegExp(`^${author.id}/[0-9a-f-]{36}\\.png$`));
    expect(await storageFileExists('post_images', img.storagePath)).toBe(true);
  }

  // 피드: 128px 썸네일 3장이 순서대로, 실제로 로드된다.
  const thumbs = firstPost.getByRole('button', { name: /^게시글 사진 \d 크게 보기$/ });
  await expect(thumbs).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const img = thumbs.nth(i).locator('img');
    await expect(img).toHaveAttribute('src', new RegExp(`/storage/v1/object/public/post_images/${created[i].storagePath}$`));
    await expectImageLoaded(img);
  }
  expect((await thumbs.first().boundingBox())!.width).toBeLessThanOrEqual(130);

  // 라이트박스: 누른 사진부터, 이전/다음·←/→, n / N
  await thumbs.nth(1).click();
  const lightbox = page.getByRole('dialog');
  await expect(lightbox).toContainText('2 / 3');
  await expectImageLoaded(lightbox.getByRole('img'));
  await page.keyboard.press('ArrowRight');
  await expect(lightbox).toContainText('3 / 3');
  await lightbox.getByRole('button', { name: '다음 사진' }).click();
  await expect(lightbox).toContainText('1 / 3');
  await page.keyboard.press('Escape');
  await expect(lightbox).toHaveCount(0);

  // 수정: 첫 사진 삭제, 새 사진 1장 추가 → 순서는 남은 사진(2,3) → 새 사진
  await firstPost.getByRole('link', { name: '수정' }).click();
  await page.waitForURL(`**/posts/${row.id}/edit`);
  await expect(page.getByLabel(/내용/)).toHaveValue(content);
  await expect(page.getByRole('group', { name: '기존 사진' }).getByRole('img')).toHaveCount(3);
  await page.getByLabel(/내용/).fill(updated);
  await page.getByRole('button', { name: '기존 사진 1 삭제' }).click();
  await page.getByLabel('사진 첨부 (선택)').setInputFiles(TEST_IMAGE);
  await expect(page.getByText('사진 3 / 10장')).toBeVisible();
  await page.getByRole('button', { name: '수정완료' }).click();
  await page.waitForURL((url) => url.pathname === '/');

  const editedPost = page.locator('article').filter({ hasText: updated });
  await expect(editedPost).toHaveCount(1);
  await expect(editedPost.getByRole('button', { name: /크게 보기$/ })).toHaveCount(3);
  const afterEdit = await imagesOf(row.id);
  expect(afterEdit.map((img) => img.storagePath).slice(0, 2)).toEqual([created[1].storagePath, created[2].storagePath]);
  expect(afterEdit.map((img) => img.position)).toEqual([0, 1, 2]);
  // 뺀 사진은 DB 행과 함께 Storage 파일도 지워진다.
  await expect.poll(() => storageFileExists('post_images', created[0].storagePath)).toBe(false);
  expect(await storageFileExists('post_images', afterEdit[2].storagePath)).toBe(true);
  for (const img of await editedPost.locator('img').all()) await expectImageLoaded(img);

  // 다른 회원: 버튼이 없고, 수정 URL로 직접 들어가도 홈으로 돌려보낸다.
  const otherPage = await loggedInPage(browser, other);
  const seenByOther = otherPage.locator('article').filter({ hasText: updated });
  await expect(seenByOther).toHaveCount(1);
  await expect(seenByOther.getByRole('link', { name: '수정' })).toHaveCount(0);
  await expect(seenByOther.getByRole('button', { name: '삭제' })).toHaveCount(0);
  await otherPage.goto(`/posts/${row.id}/edit`);
  await expect(otherPage).toHaveURL('/');

  // 비회원도 글과 사진은 볼 수 있지만 버튼은 없다.
  const guest = await browser.newPage();
  await guest.goto('/');
  const seenByGuest = guest.locator('article').filter({ hasText: updated });
  await expect(seenByGuest).toHaveCount(1);
  await expect(seenByGuest.getByRole('button', { name: /크게 보기$/ })).toHaveCount(3);
  await expect(seenByGuest.getByRole('link', { name: '수정' })).toHaveCount(0);

  // 작성자 삭제(확인 창 수락) → 남은 사진 파일도 Storage에서 지워진다.
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toBe('정말로 삭제하시겠습니까?');
    dialog.accept();
  });
  await editedPost.getByRole('button', { name: '삭제' }).click();
  await expect(page.locator('article').filter({ hasText: updated })).toHaveCount(0);
  expect(await db.select().from(posts).where(eq(posts.id, row.id))).toHaveLength(0);
  expect(await imagesOf(row.id)).toHaveLength(0);
  for (const img of afterEdit) {
    await expect.poll(() => storageFileExists('post_images', img.storagePath)).toBe(false);
  }

  await Promise.all([page.context().close(), otherPage.context().close(), guest.close()]);
});

test('사진 규칙: 11장·10MB 초과·이미지가 아닌 파일은 고르는 단계에서 막힌다', async ({ browser }) => {
  const page = await loggedInPage(browser, author, '/posts/write');
  const input = page.getByLabel('사진 첨부 (선택)');

  await input.setInputFiles(Array.from({ length: 11 }, () => TEST_IMAGE));
  await expect(page.getByText('사진은 최대 10장까지 올릴 수 있습니다.')).toBeVisible();
  await expect(page.getByRole('group', { name: '새 사진' })).toHaveCount(0);

  await input.setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(page.getByText('사진은 한 장에 10MB 이하여야 합니다.')).toBeVisible();

  await input.setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
  await expect(page.getByText('이미지 파일만 올릴 수 있습니다.')).toBeVisible();
  await expect(page.getByRole('group', { name: '새 사진' })).toHaveCount(0);

  // 10장까지는 된다.
  await input.setInputFiles(Array.from({ length: 10 }, () => TEST_IMAGE));
  await expect(page.getByText('사진 10 / 10장')).toBeVisible();
  await page.context().close();
});

test('게시글 삭제 확인 창에서 취소하면 지워지지 않는다', async ({ browser }) => {
  const content = `E2E 취소 ${Date.now()}`;
  const page = await loggedInPage(browser, author, '/posts/write');
  await page.getByLabel(/내용/).fill(content);
  await page.getByRole('button', { name: '게시하기' }).click();
  await page.waitForURL((url) => url.pathname === '/');

  const post = page.locator('article').filter({ hasText: content });
  // 사진 없이 쓴 글에는 이미지 영역이 없다.
  await expect(post.getByRole('button', { name: /크게 보기$/ })).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.dismiss());
  await post.getByRole('button', { name: '삭제' }).click();
  await page.reload();
  await expect(page.locator('article').filter({ hasText: content })).toHaveCount(1);
  await page.context().close();
});

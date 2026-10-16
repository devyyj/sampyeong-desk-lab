import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { cleanupE2EData, createTestUser, db, expectImageLoaded, login, logout, TEST_IMAGE, type TestUser } from './helpers';
import { comments, posts } from '../drizzle/schema';

/**
 * 모바일(iPhone 13 뷰포트) E2E: 모바일 중심 개편의 앱 셸과 핵심 흐름을 실제 DB·Storage로 확인한다.
 * - 로고 헤더 고정, 하단 탭바 이동, 탭별 ＋ 버튼
 * - 사진을 실제로 첨부해 글쓰기(전체 화면 작성 모드) → 피드 썸네일·라이트박스
 * - 댓글 바텀시트에서 댓글 작성, 보드게임 카테고리 시트, MY에서 로그아웃
 * playwright.config.ts의 mobile 프로젝트에서만 돈다.
 */
let member: TestUser;

test.beforeAll(async () => {
  member = await createTestUser('mobile');
});

test.afterAll(cleanupE2EData);

const tabs = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: '주요 메뉴' });

test('비회원: 로고 헤더와 하단 탭바로 이동하고, ＋는 로그인으로 보낸다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'SDL 삼평동 책상 전략 연구소 홈' })).toBeVisible();
  await expect(tabs(page).getByRole('link')).toHaveCount(4);
  // 가로 스크롤이 생기지 않는다.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  for (const [label, path] of [['보드게임', '/boardgames'], ['회원', '/members'], ['MY', '/my']] as const) {
    await tabs(page).getByRole('link', { name: label }).click();
    await page.waitForURL((url) => url.pathname === path);
    await expect(tabs(page).getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    // 로고 헤더는 모든 화면에 고정되어 있다.
    await expect(page.getByRole('banner')).toBeVisible();
  }

  await tabs(page).getByRole('link', { name: '피드' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.getByRole('link', { name: '글쓰기' }).click();
  await page.waitForURL('**/login?redirect=%2Fposts%2Fwrite');
});

test('회원: 사진 첨부 글쓰기 → 피드 썸네일 → 댓글 시트 → 보드게임 카테고리 시트 → 로그아웃', async ({ page }) => {
  test.setTimeout(90_000);
  const content = `E2E 모바일 글 ${Date.now()}`;
  await login(page, member, '/');

  // ＋ → 전체 화면 작성 모드: 로고 헤더·탭바가 숨고 상단 바(취소 | 새 게시글 | 게시하기)만 있다.
  await page.getByRole('link', { name: '글쓰기' }).click();
  await page.waitForURL('**/posts/write');
  await expect(tabs(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '새 게시글' })).toBeVisible();
  await page.getByLabel('사진 첨부 (선택)').setInputFiles([TEST_IMAGE, TEST_IMAGE]);
  await expect(page.getByRole('group', { name: '새 사진' }).getByRole('img')).toHaveCount(2);
  await page.getByLabel(/내용/).fill(content);
  await page.getByRole('button', { name: '게시하기' }).click();
  await page.waitForURL((url) => url.pathname === '/');

  // 피드 카드: 사진은 작은 썸네일(3칸 격자의 한 칸, 화면 폭의 1/3 정도)로 보이고 실제로 로드된다.
  const card = page.locator('article').filter({ hasText: content });
  const photos = card.getByRole('region', { name: '사진 2장' });
  await expect(photos).toBeVisible();
  const thumb = photos.getByRole('button', { name: /크게 보기$/ }).first();
  expect((await thumb.boundingBox())!.width).toBeLessThan(140);
  await expectImageLoaded(thumb.locator('img'));
  // 누르면 전체 화면으로 크게 본다.
  await thumb.click();
  await expect(page.getByRole('dialog')).toContainText('1 / 2');
  await page.keyboard.press('Escape');

  // 댓글은 바텀시트에서 쓴다.
  await card.getByRole('button', { name: '댓글 0', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '댓글' });
  await sheet.getByRole('textbox', { name: '댓글 쓰기' }).fill('E2E 모바일 댓글');
  await sheet.getByRole('button', { name: '댓글 달기' }).click();
  await expect(sheet.getByRole('listitem').filter({ hasText: 'E2E 모바일 댓글' })).toBeVisible();
  await sheet.getByRole('button', { name: '닫기' }).click();
  await expect(card.getByRole('button', { name: '댓글 1', exact: true })).toBeVisible();
  const [post] = await db.select().from(posts).where(eq(posts.content, content));
  expect(await db.select().from(comments).where(eq(comments.postId, post.id))).toHaveLength(1);

  // 보드게임: 카테고리 칩 → 시트에서 고르면 그 카테고리만.
  await tabs(page).getByRole('link', { name: '보드게임' }).click();
  await page.waitForURL('**/boardgames');
  await page.getByRole('button', { name: '카테고리' }).click();
  const first = page.getByRole('dialog', { name: '카테고리' }).getByRole('link').first();
  const [, category, count] = (await first.textContent())!.trim().match(/^(.*) (\d+)$/)!;
  await first.click();
  // 쿼리의 공백은 URLSearchParams가 '+'로 인코딩하므로 주소 문자열 대신 파싱한 값으로 비교한다.
  await page.waitForURL((url) => url.searchParams.get('category') === category);
  await expect(page.getByRole('button', { name: `카테고리: ${category}` })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(Number(count));

  await logout(page);
});

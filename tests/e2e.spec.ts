import { test, expect } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { eq, like } from 'drizzle-orm';
import { db } from '../src/db/index';
import { users, boardGames, posts } from '../drizzle/schema';

loadEnvConfig(process.cwd());

const TEST_USER = `testuser_${Date.now()}`;
const TEST_PIN = '1234';

const testImageBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const testImage = {
  name: 'test-image.png',
  mimeType: 'image/png',
  buffer: testImageBuffer
};

test.afterAll(async () => {
  await db.delete(posts).where(like(posts.content, 'Playwright Test Post%'));
  await db.delete(boardGames).where(like(boardGames.name, 'Test Game%'));
  await db.delete(users).where(like(users.username, 'testuser_%'));
});

test('SDL Comprehensive CRUD User Journey', async ({ page }) => {
  // Scenario 6: Unauthorized Access Check
  await page.goto('/mypage');
  await page.waitForURL('**/login**');
  
  // Scenario 1: Authentication Flow
  await page.goto('/signup');
  await page.fill('input[name="username"]', TEST_USER);
  await page.fill('input[name="department"]', 'QA Team');
  await page.fill('input[name="pin"]', TEST_PIN);
  await page.fill('input[name="confirmPin"]', TEST_PIN);
  await page.locator('button', { hasText: '가입하기' }).click();
  await page.waitForURL('/');
  await expect(page.locator('button', { hasText: '로그아웃' })).toBeVisible();

  // Scenario 4: Post Management (CRUD)
  // Create Post
  await page.goto('/posts/write');
  await page.fill('textarea[name="content"]', 'Playwright Test Post - Hello SDL!');
  await page.locator('input[type="file"]').setInputFiles(testImage);
  await page.locator('button', { hasText: '게시하기' }).click();
  await expect(page.locator('text=Playwright Test Post - Hello SDL!').first()).toBeVisible();

  // Update Post
  await page.locator('text=수정').first().click();
  await page.waitForURL('**/edit');
  await page.fill('textarea[name="content"]', 'Playwright Test Post - Updated!');
  await page.locator('button', { hasText: '수정완료' }).click();
  await page.waitForURL('/');
  await expect(page.locator('text=Playwright Test Post - Updated!').first()).toBeVisible();

  // Delete Post (Handle confirm dialog)
  page.once('dialog', dialog => dialog.accept());
  await page.locator('text=삭제').first().click();
  await expect(page.locator('text=Playwright Test Post - Updated!')).not.toBeVisible();

  // Scenario 3: Board Game Management (CRUD)
  // Create Boardgame
  await page.goto('/boardgames/add');
  await page.fill('input[name="name"]', 'Test Game 1');
  await page.fill('input[name="recommendedPlayers"]', '4');
  await page.fill('input[name="playTime"]', '60');
  await page.locator('input[type="file"]').setInputFiles(testImage);
  await page.locator('button', { hasText: '등록하기' }).click();
  await page.waitForURL('**/boardgames');
  await expect(page.locator('text=Test Game 1').first()).toBeVisible();

  // Update Boardgame
  await page.locator('text=수정').first().click();
  await page.waitForURL('**/edit');
  await page.fill('input[name="name"]', 'Test Game Updated');
  await page.selectOption('select[name="status"]', 'PLAYING');
  await page.locator('button', { hasText: '수정완료' }).click();
  await page.waitForURL('**/boardgames');
  await expect(page.locator('text=Test Game Updated').first()).toBeVisible();
  await expect(page.locator('text=플레이 중').first()).toBeVisible();

  // Delete Boardgame (Handle confirm dialog)
  page.once('dialog', dialog => dialog.accept());
  await page.locator('text=삭제').first().click();
  await expect(page.locator('text=Test Game Updated')).not.toBeVisible();

  // Scenario 5: Member Directory
  await page.goto('/members');
  await expect(page.locator(`text=${TEST_USER}`)).toBeVisible();
  await expect(page.locator('text=QA Team').first()).toBeVisible();

  // Scenario 2: User Profile Management
  await page.goto('/mypage');
  await page.fill('input[name="bio"]', 'Updated Bio for testing.');
  await page.locator('input[type="file"]').setInputFiles(testImage);
  await page.locator('button', { hasText: '정보 수정' }).click();
  await expect(page.locator('text=정보가 성공적으로 수정되었습니다.').first()).toBeVisible();
  await expect(page.locator('input[name="bio"]')).toHaveValue('Updated Bio for testing.');
  
  // Logout
  await page.locator('button', { hasText: '로그아웃' }).click();
  await page.waitForURL('**/login');
});

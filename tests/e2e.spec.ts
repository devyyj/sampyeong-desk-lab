import { test, expect } from '@playwright/test';

const TEST_USER = `testuser_${Date.now()}`;
const TEST_PIN = '1234';

test('SDL Complete User Journey', async ({ page }) => {
  // 1. Signup
  await page.goto('/signup');
  await page.fill('input[name="username"]', TEST_USER);
  await page.fill('input[name="department"]', 'QA Team');
  await page.fill('input[name="pin"]', TEST_PIN);
  await page.locator('button', { hasText: '가입하기' }).click();
  await page.waitForURL('/');
  
  // Verify we are logged in by checking GNB
  await expect(page.locator('button', { hasText: '로그아웃' })).toBeVisible();

  // 2. Add Board Game
  await page.goto('/boardgames/add');
  await page.fill('input[name="name"]', 'Test Game');
  await page.fill('input[name="recommendedPlayers"]', '4');
  await page.fill('input[name="playTime"]', '60');
  await page.locator('button', { hasText: '등록하기' }).click();
  await page.waitForURL('**/boardgames');
  await expect(page.locator('text=Test Game').first()).toBeVisible();

  // 3. Member List
  await page.goto('/members');
  await expect(page.locator(`text=${TEST_USER}`)).toBeVisible();
  await expect(page.locator('text=QA Team').first()).toBeVisible();

  // 4. Mypage
  await page.goto('/mypage');
  await page.fill('input[name="bio"]', 'Hello, this is a test bio.');
  await page.locator('button', { hasText: '정보 수정' }).click();
  // Wait for success message
  await expect(page.locator('text=정보가 성공적으로 수정되었습니다.').first()).toBeVisible();
  await expect(page.locator('input[name="bio"]')).toHaveValue('Hello, this is a test bio.');

  // 5. Logout
  await page.locator('button', { hasText: '로그아웃' }).click();
  await page.waitForURL('**/login');
});

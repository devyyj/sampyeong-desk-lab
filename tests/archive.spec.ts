import { test, expect, type Page } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { desc, eq, like, sql } from 'drizzle-orm';
import { db } from '../src/db/index';
import { activities, activityPhotos, users } from '../drizzle/schema';
import { hashPIN } from '../src/lib/auth-utils';

loadEnvConfig(process.cwd());

/**
 * 이관 데이터 조회 메뉴(활동 기록·회원 명부·동호회 안내·보드게임 필터) E2E.
 * 실제 DB(이관 데이터)와 실제 Storage(private activity_photos 버킷)를 대상으로,
 * 회원에게 발급한 signed URL 사진이 브라우저에서 실제로 로드되는지까지 확인한다(AGENTS.md 5·6번).
 */
const TEST_USER = `testuser_archive_${Date.now()}`;
const TEST_PIN = '5678';

let activityWithPhotos: { id: string; title: string; photoCount: number };

test.beforeAll(async () => {
  // PIN 변경 강제 화면을 거치지 않도록 mustChangePin=false인 회원을 직접 만든다.
  await db.insert(users).values({
    username: TEST_USER,
    pinHash: await hashPIN(TEST_PIN),
    displayName: 'E2E 테스트',
    department: 'QA',
    mustChangePin: false,
  });

  const [row] = await db
    .select({ id: activities.id, title: activities.title, photoCount: sql<number>`count(${activityPhotos.id})::int` })
    .from(activities)
    .innerJoin(activityPhotos, eq(activityPhotos.activityId, activities.id))
    .groupBy(activities.id)
    .orderBy(desc(activities.date))
    .limit(1);
  activityWithPhotos = row;
});

test.afterAll(async () => {
  await db.delete(users).where(like(users.username, 'testuser_archive_%'));
});

async function login(page: Page, redirect: string) {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
  await page.fill('input[name="username"]', TEST_USER);
  await page.fill('input[name="pin"]', TEST_PIN);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(`**${redirect}`);
}

test('비회원: 활동 기록은 보이지만 사진은 로그인 안내, 회원 명부는 로그인 화면으로', async ({ page }) => {
  await page.goto('/activities');
  await expect(page.getByRole('heading', { name: '활동 기록' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '시즌 선택' }).getByRole('link')).not.toHaveCount(0);

  await page.goto(`/activities/${activityWithPhotos.id}`);
  await expect(page.getByRole('heading', { name: activityWithPhotos.title })).toBeVisible();
  await expect(page.getByText(`로그인하면 사진 ${activityWithPhotos.photoCount}장을 볼 수 있습니다.`)).toBeVisible();
  // 비회원 HTML에는 signed URL이 아예 없어야 한다.
  expect(await page.content()).not.toContain('/storage/v1/object/sign/activity_photos');

  await page.goto('/members');
  await page.waitForURL('**/login?redirect=%2Fmembers');
});

test('회원: 활동 사진이 signed URL로 실제 로드되고, 시즌 명부가 보인다', async ({ page }) => {
  await login(page, `/activities/${activityWithPhotos.id}`);

  const photos = page.locator('article img');
  await expect(photos).toHaveCount(activityWithPhotos.photoCount);
  const first = photos.first();
  await expect(first).toHaveAttribute('src', /\/storage\/v1\/object\/sign\/activity_photos\//);
  // 이미지가 실제로 디코딩되었는지(깨진 이미지가 아닌지) 확인
  await expect.poll(() => first.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

  await page.goto('/members');
  await expect(page.getByRole('heading', { name: /회원 명부 \(\d+명\)/ })).toBeVisible();
  await expect(page.getByText('회장').first()).toBeVisible();
});

test('동호회 안내와 보드게임 필터', async ({ page }) => {
  await page.goto('/about');
  await page.waitForURL('**/about/rules');
  await expect(page.getByRole('link', { name: '회칙' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: '공용 보관함 안내' }).click();
  await page.waitForURL('**/about/shared-cabinet');
  await expect(page.locator('.markdown')).not.toBeEmpty();

  await page.goto('/boardgames');
  await page.getByRole('navigation', { name: '보드게임 필터' }).getByRole('link', { name: /^공용 보관함 \d+$/ }).click();
  await page.waitForURL('**/boardgames?cabinet=1');
  const cards = page.locator('article');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(cards.nth(i)).toContainText('공용 보관함');
  }
});

test('모바일: 햄버거 메뉴로 이동', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeHidden();
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await page.getByRole('navigation', { name: '모바일 메뉴' }).getByRole('link', { name: '활동 기록' }).click();
  await page.waitForURL('**/activities');
  await expect(page.getByRole('navigation', { name: '모바일 메뉴' })).toBeHidden();
});

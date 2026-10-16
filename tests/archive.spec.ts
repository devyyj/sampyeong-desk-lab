import { test, expect } from '@playwright/test';
import { desc, eq, sql } from 'drizzle-orm';
import { cleanupE2EData, createTestUser, db, login as loginAs, type TestUser } from './helpers';
import { activities, activityPhotos, seasons } from '../drizzle/schema';

/**
 * 이관 데이터 조회 메뉴(활동 기록·회원 명부·동호회 안내·보드게임 필터) E2E.
 * 실제 DB(이관 데이터)와 실제 Storage(private activity_photos 버킷)를 대상으로,
 * 회원에게 발급한 signed URL 사진이 브라우저에서 실제로 로드되는지까지 확인한다(AGENTS.md 5·6번).
 */
let member: TestUser;
let activityWithPhotos: { id: string; title: string; photoCount: number };

test.beforeAll(async () => {
  // PIN 변경 강제 화면을 거치지 않도록 mustChangePin=false인 회원을 직접 만든다.
  member = await createTestUser('archive');

  const [row] = await db
    .select({ id: activities.id, title: activities.title, photoCount: sql<number>`count(${activityPhotos.id})::int` })
    .from(activities)
    .innerJoin(activityPhotos, eq(activityPhotos.activityId, activities.id))
    .groupBy(activities.id)
    .orderBy(desc(activities.date))
    .limit(1);
  activityWithPhotos = row;
});

test.afterAll(cleanupE2EData);

const login = (page: Parameters<typeof loginAs>[0], redirect: string) => loginAs(page, member, redirect);

test('비회원: 활동 기록은 보이지만 사진은 로그인 안내, 회원 명부는 로그인 안내만', async ({ page }) => {
  await page.goto('/activities');
  await expect(page.getByRole('heading', { name: '활동 기록' })).toBeVisible();
  // 시즌 선택 없이 전체 목록이 시즌 제목으로 묶여 나온다.
  await expect(page.getByRole('combobox', { name: '시즌 선택' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: /^시즌 \d+/ }).first()).toBeVisible();

  await page.goto(`/activities/${activityWithPhotos.id}`);
  await expect(page.getByRole('heading', { name: activityWithPhotos.title })).toBeVisible();
  await expect(page.getByText(`로그인하면 사진 ${activityWithPhotos.photoCount}장을 볼 수 있습니다.`)).toBeVisible();
  // 비회원 HTML에는 signed URL이 아예 없어야 한다.
  expect(await page.content()).not.toContain('/storage/v1/object/sign/activity_photos');

  // 회원 명부는 로그인 화면으로 보내지 않고 그 자리에서 안내한다. 명부(실명)는 HTML에 없어야 한다.
  await page.goto('/members');
  await expect(page).toHaveURL('/members');
  await expect(page.getByText('회원 명부는 로그인해야 확인할 수 있습니다.')).toBeVisible();
  await expect(page.getByRole('heading', { name: /회원 명부 \(\d+명\)/ })).toHaveCount(0);
  await expect(page.getByText('회장')).toHaveCount(0);
  // 안내의 로그인 버튼으로 로그인하면 명부로 돌아온다.
  await page.getByRole('main').getByRole('link', { name: '로그인' }).click();
  await page.waitForURL('**/login?redirect=%2Fmembers');
  await page.getByLabel('아이디').fill(member.username);
  await page.getByLabel('비밀번호 (4자리 PIN)').fill(member.pin);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL((url) => url.pathname === '/members');
  await expect(page.getByRole('heading', { name: /회원 명부 \(\d+명\)/ })).toBeVisible();
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
  // 이름 옆에 [회장](그 시즌 직책) 또는 [N시즌](참여 수)이 붙는다. 회장 카드에는 참여 수를 붙이지 않는다.
  await expect(page.getByText('[회장]', { exact: true })).toHaveCount(1);
  const cards = page.locator('main h3').locator('..');
  const cardCount = await cards.count();
  for (let i = 0; i < cardCount; i++) {
    await expect(cards.nth(i)).toHaveText(/\[(회장|\d+시즌)\]/);
  }
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

test('모바일: 메뉴를 열지 않아도 헤더에 로그인/마이페이지·로그아웃 버튼이 보인다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const account = page.getByRole('banner').getByRole('group', { name: '계정' });
  await expect(account.getByRole('link', { name: '로그인' })).toBeVisible();
  await expect(account.getByRole('link', { name: '마이페이지' })).toHaveCount(0);

  await account.getByRole('link', { name: '로그인' }).click();
  await page.waitForURL('**/login');
  await page.getByLabel('아이디').fill(member.username);
  await page.getByLabel('비밀번호 (4자리 PIN)').fill(member.pin);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await expect(account.getByRole('link', { name: '마이페이지' })).toBeVisible();
  await expect(account.getByRole('button', { name: '로그아웃' })).toBeVisible();
  await expect(account.getByRole('link', { name: '로그인' })).toHaveCount(0);
  // 버튼이 화면 밖으로 밀려나지 않아야 한다(390px 폭 안에 들어옴).
  const box = await account.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);

  await account.getByRole('button', { name: '로그아웃' }).click();
  await page.waitForURL('**/login');
  await expect(account.getByRole('link', { name: '로그인' })).toBeVisible();
});

test('활동 기록: 시즌 선택 없이 무한 스크롤로 모든 활동을 시즌별로 묶어 보여준다', async ({ page }) => {
  // 실제 DB 기준 기대값: 전체 수와 시즌별 수(최신 시즌부터).
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(activities);
  const perSeason = await db
    .select({ id: seasons.id, name: seasons.name, count: sql<number>`count(${activities.id})::int` })
    .from(seasons)
    .innerJoin(activities, eq(activities.seasonId, seasons.id))
    .groupBy(seasons.id)
    .orderBy(desc(seasons.id));

  await page.goto('/activities');
  await expect(page.getByRole('combobox', { name: '시즌 선택' })).toHaveCount(0);
  await expect(page.getByText(`활동 ${total}건`)).toBeVisible();

  // 첫 화면에는 한 페이지(20건)만 있고, 바닥까지 스크롤하면 이어서 불러온다.
  const rows = page.locator('section ul li a');
  if (total > 20) await expect(rows).toHaveCount(20);
  const done = page.getByText('모든 활동을 불러왔습니다.');
  while (!(await done.isVisible())) {
    await page.mouse.wheel(0, 5000);
    // 다음 페이지가 붙거나 끝 문구가 나올 때까지 기다린다.
    await expect.poll(async () => (await done.isVisible()) || (await page.getByRole('status').count()) === 0).toBe(true);
  }
  await expect(rows).toHaveCount(total);
  // 같은 활동이 두 번 나오지 않는다.
  const hrefs = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  expect(new Set(hrefs).size).toBe(total);

  // 시즌마다 제목이 한 번씩, 최신 시즌부터, 시즌 전체 건수와 함께 나온다.
  const headings = page.getByRole('heading', { level: 2 });
  await expect(headings).toHaveCount(perSeason.length);
  for (const [i, season] of perSeason.entries()) {
    await expect(headings.nth(i)).toContainText(season.name);
    const section = page.getByRole('region', { name: new RegExp(`^${season.name}`) });
    await expect(section).toContainText(`${season.count}건`);
    await expect(section.locator('ul li a')).toHaveCount(season.count);
  }

  // 상세로 들어가면 시즌이 머리말에 보이고, 돌아가기 링크는 전체 목록으로 간다.
  await rows.first().click();
  await page.waitForURL(/\/activities\/[0-9a-f-]{36}$/);
  await expect(page.locator('header').getByText(perSeason[0].name, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '← 활동 기록' }).click();
  await page.waitForURL((url) => url.pathname === '/activities' && url.search === '');
});

test('회원 명부는 시즌 셀렉트로 고른 시즌을 보여주고 선택이 쿼리로 유지된다', async ({ page }) => {
  const [{ id: seasonId, name: seasonName }] = await db.select().from(seasons).orderBy(seasons.id).limit(1);
  await login(page, `/members?season=${seasonId}`);
  const select = page.getByRole('combobox', { name: '시즌 선택' });
  await expect(select).toHaveValue(String(seasonId));
  await expect(page.getByRole('heading', { name: new RegExp(`${seasonName} 회원 명부 \\(\\d+명\\)`) })).toBeVisible();
});

test('없는 활동·문서는 500이 아닌 404로 응답한다', async ({ page }) => {
  for (const path of ['/activities/not-a-uuid', '/activities/00000000-0000-4000-8000-000000000000', '/about/unknown']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

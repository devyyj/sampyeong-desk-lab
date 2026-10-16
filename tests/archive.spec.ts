import { test, expect } from '@playwright/test';
import { and, desc, eq, sql } from 'drizzle-orm';
import { cleanupE2EData, createTestUser, db, login as loginAs, type TestUser } from './helpers';
import { postImages, posts, seasons } from '../drizzle/schema';

/**
 * 이관 데이터 조회 메뉴(활동 기록·회원 명부·동호회 안내·보드게임 필터) E2E.
 * 활동 기록은 게시글의 한 종류(kind='activity')로 합쳐져 피드의 "활동 기록" 필터와 /posts/[id]에서 본다.
 * 실제 DB(이관 데이터)와 실제 Storage(private activity_photos 버킷)를 대상으로,
 * 회원에게 발급한 signed URL 사진이 브라우저에서 실제로 로드되는지까지 확인한다(AGENTS.md 5·6번).
 */
let member: TestUser;
let activityWithPhotos: { id: string; title: string; photoCount: number };

test.beforeAll(async () => {
  // PIN 변경 강제 화면을 거치지 않도록 mustChangePin=false인 회원을 직접 만든다.
  member = await createTestUser('archive');

  const [row] = await db
    .select({ id: posts.id, title: posts.title, photoCount: sql<number>`count(${postImages.id})::int` })
    .from(posts)
    .innerJoin(postImages, eq(postImages.postId, posts.id))
    .where(eq(posts.kind, 'activity'))
    .groupBy(posts.id)
    .orderBy(desc(posts.activityDate))
    .limit(1);
  activityWithPhotos = { ...row, title: row.title! };
});

test.afterAll(cleanupE2EData);

const login = (page: Parameters<typeof loginAs>[0], redirect: string) => loginAs(page, member, redirect);

test('비회원: 활동 기록은 보이지만 사진은 로그인 안내, 회원 명부는 로그인 안내만', async ({ page }) => {
  // 예전 주소는 피드의 활동 기록 필터로 영구 이동한다.
  await page.goto('/activities');
  await page.waitForURL((url) => url.pathname === '/' && url.searchParams.get('kind') === 'activity');
  await expect(page.getByRole('navigation', { name: '글 종류' }).getByRole('link', { name: '활동 기록' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('article').first()).toBeVisible();

  // 예전 상세 주소는 같은 id의 게시글 상세로 간다(이관 때 id 유지).
  await page.goto(`/activities/${activityWithPhotos.id}`);
  await page.waitForURL(`**/posts/${activityWithPhotos.id}`);
  await expect(page.getByRole('heading', { name: activityWithPhotos.title })).toBeVisible();
  await expect(page.getByText(`로그인하면 사진 ${activityWithPhotos.photoCount}장을 볼 수 있어요`)).toBeVisible();
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
  await login(page, `/posts/${activityWithPhotos.id}`);

  const photos = page.getByRole('region', { name: `사진 ${activityWithPhotos.photoCount}장` }).locator('img');
  await expect(photos).toHaveCount(activityWithPhotos.photoCount);
  const first = photos.first();
  await expect(first).toHaveAttribute('src', /\/storage\/v1\/object\/sign\/activity_photos\//);
  // 이미지가 실제로 디코딩되었는지(깨진 이미지가 아닌지) 확인
  await expect.poll(() => first.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

  await page.goto('/members');
  await expect(page.getByRole('heading', { name: /회원 명부 \(\d+명\)/ })).toBeVisible();
  // 이름 옆에 👑 회장(그 시즌 직책) 또는 Lv.N(참여 시즌 수)이 붙는다. 회장에게는 레벨을 붙이지 않는다.
  const rows = page.locator('main ul > li');
  await expect(rows.filter({ hasText: '회장' })).toHaveCount(1);
  await expect(rows.filter({ hasText: '회장' })).not.toContainText('Lv.');
  // 정렬: 회장 → 레벨 높은 순.
  const levels = (await rows.allTextContents()).map((t) => (t.includes('회장') ? 99 : Number(/Lv\.(\d+)/.exec(t)?.[1] ?? 0)));
  expect(levels).toEqual([...levels].sort((x, y) => y - x));
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

test('활동 기록 필터: 무한 스크롤로 모든 활동을 불러오고, 종류 칩으로 좁힌다', async ({ page }) => {
  // 실제 DB 기준 기대값(이관 91건 + 다른 테스트가 만든 활동이 있을 수 있어 DB에서 센다).
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(posts).where(eq(posts.kind, 'activity'));
  const [{ escape }] = await db
    .select({ escape: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.kind, 'activity'), eq(posts.activityType, 'ESCAPE_ROOM')));

  await page.goto('/?kind=activity');
  // 첫 화면에는 한 페이지(10건)만 있고, 바닥까지 스크롤하면 이어서 불러온다.
  const cards = page.getByRole('article');
  if (total > 10) await expect(cards).toHaveCount(10);
  const done = page.getByText('모든 글을 불러왔어요');
  while (!(await done.isVisible())) {
    await page.mouse.wheel(0, 8000);
    // 다음 페이지가 붙거나 끝 문구가 나올 때까지 기다린다.
    await expect.poll(async () => (await done.isVisible()) || (await page.getByRole('status').count()) === 0).toBe(true);
  }
  await expect(cards).toHaveCount(total);
  // 같은 글이 두 번 나오지 않는다(카드의 시간 링크 = 상세 주소).
  const hrefs = await cards.evaluateAll((els) => els.map((el) => el.querySelector('header a[href^="/posts/"]')?.getAttribute('href')));
  expect(new Set(hrefs).size).toBe(total);

  // 종류 칩: 방탈출만.
  await page.getByRole('navigation', { name: '활동 종류' }).getByRole('link', { name: '방탈출' }).click();
  await page.waitForURL((url) => url.searchParams.get('type') === 'ESCAPE_ROOM');
  if (escape <= 10) {
    await expect(cards).toHaveCount(escape);
    for (const card of await cards.all()) await expect(card).toContainText('방탈출');
  }

  // 제목을 누르면 상세로 가고, 돌아가기는 피드로 간다.
  await cards.first().getByRole('heading').getByRole('link').click();
  await page.waitForURL(/\/posts\/[0-9a-f-]{36}$/);
  await page.getByRole('link', { name: '피드로 돌아가기' }).click();
  await page.waitForURL((url) => url.pathname === '/');
});

test('회원 명부는 시즌 칩으로 고른 시즌을 보여주고 선택이 쿼리로 유지된다', async ({ page }) => {
  const [{ id: seasonId, name: seasonName }] = await db.select().from(seasons).orderBy(seasons.id).limit(1);
  await login(page, '/members');
  const chips = page.getByRole('navigation', { name: '시즌 선택' });
  await chips.getByRole('link', { name: seasonName }).click();
  await page.waitForURL(`**/members?season=${seasonId}`);
  await expect(chips.getByRole('link', { name: seasonName })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: new RegExp(`${seasonName} 회원 명부 \\(\\d+명\\)`) })).toBeVisible();
});

test('없는 글·문서는 500이 아닌 404로 응답한다(예전 활동 주소는 리디렉트 후 404)', async ({ page }) => {
  for (const path of ['/posts/not-a-uuid', '/posts/00000000-0000-4000-8000-000000000000', '/activities/00000000-0000-4000-8000-000000000000', '/about/unknown']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

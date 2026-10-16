import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { cleanupE2EData, createTestUser, db, loggedInPage, type TestUser } from './helpers';
import { boardGames } from '../drizzle/schema';

/**
 * 보드게임 현황 E2E: 등록(썸네일 없이 정보만) → 필터·검색 → 공용 보관함 여부 수정 → 삭제, 목록에 이미지가 없는지,
 * 그리고 보유자(실명)가 비회원에게 노출되지 않는지(검색으로도).
 */
let member: TestUser;

test.beforeAll(async () => {
  member = await createTestUser('gamer');
});

test.afterAll(cleanupE2EData);

test('보드게임: 등록 → 미분류 필터 → 검색 → 공용 보관함 수정 → 삭제', async ({ browser }) => {
  const name = `E2E 게임 ${Date.now()}`;
  const renamed = `${name} 개정판`;
  const page = await loggedInPage(browser, member, '/boardgames');

  await page.getByRole('link', { name: '새 보드게임 등록' }).click();
  await page.waitForURL('**/boardgames/add');
  await page.getByLabel(/보드게임 이름/).fill(name);
  await page.getByLabel('추천 인원').fill('2~4명');
  await page.getByLabel('플레이 시간').fill('30분');
  // 목록에서 이미지를 쓰지 않으므로 등록 폼에도 썸네일 입력란이 없다.
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  // 보관 상태 선택 없이 공용 보관함 여부만 체크한다(기본 꺼짐).
  await expect(page.getByLabel('상태')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: '공용 보관함에 보관' })).not.toBeChecked();
  await page.getByRole('button', { name: '등록하기' }).click();
  await page.waitForURL((url) => url.pathname === '/boardgames');

  const card = page.locator('article').filter({ hasText: name });
  await expect(card).toHaveCount(1);
  // 한 줄 요약: 카테고리 · 인원 · 시간
  await expect(card).toContainText('미분류 · 2~4명 · 30분');
  await expect(card).not.toContainText(/보관 중|플레이 중|대여 중|공용 보관함/);

  const [row] = await db.select().from(boardGames).where(eq(boardGames.name, name));
  expect(row).toMatchObject({ addedById: member.id, status: 'AVAILABLE', inSharedCabinet: false, category: null, thumbnailUrl: null });

  // 카테고리 없는 새 게임은 '미분류' 필터에 나오고, 공용 보관함 필터에는 나오지 않는다.
  const filters = page.getByRole('navigation', { name: '보드게임 필터' });
  await filters.getByRole('link', { name: /^미분류 \d+$/ }).click();
  await page.waitForURL(/category=%EB%AF%B8%EB%B6%84%EB%A5%98/);
  await expect(filters.getByRole('link', { name: /^미분류 \d+$/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('article').filter({ hasText: name })).toHaveCount(1);
  await filters.getByRole('link', { name: /^공용 보관함 \d+$/ }).click();
  await page.waitForURL('**/boardgames?cabinet=1');
  await expect(page.locator('article').filter({ hasText: name })).toHaveCount(0);
  await filters.getByRole('link', { name: /^전체 \d+$/ }).click();
  await page.waitForURL((url) => url.pathname === '/boardgames' && url.search === '');

  // 검색: 띄어쓰기·대소문자를 무시하고 이름으로 찾는다. 결과는 ?q= 주소로 남는다.
  const search = page.getByRole('searchbox', { name: '보드게임 검색' });
  await search.fill(name.replace('E2E', 'e2e').replace(/ /g, ''));
  await page.getByRole('button', { name: '검색' }).click();
  await page.waitForURL(/[?&]q=/);
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.locator('article')).toContainText(name);
  await page.getByRole('link', { name: '검색 지우기' }).click();
  await page.waitForURL((url) => url.pathname === '/boardgames' && url.search === '');

  // 수정: 이름 변경 + 공용 보관함에 넣기 → 공용 보관함 필터에 나온다.
  await page.locator('article').filter({ hasText: name }).getByRole('link', { name: '수정' }).click();
  await page.waitForURL(`**/boardgames/${row.id}/edit`);
  await expect(page.getByLabel(/보드게임 이름/)).toHaveValue(name);
  await expect(page.getByLabel('상태')).toHaveCount(0);
  await page.getByLabel(/보드게임 이름/).fill(renamed);
  await page.getByRole('checkbox', { name: '공용 보관함에 보관' }).check();
  await page.getByRole('button', { name: '수정완료' }).click();
  await page.waitForURL((url) => url.pathname === '/boardgames');
  const renamedCard = page.locator('article').filter({ hasText: renamed });
  await expect(renamedCard).toContainText('공용 보관함');
  expect((await db.select().from(boardGames).where(eq(boardGames.id, row.id)))[0]).toMatchObject({ name: renamed, inSharedCabinet: true });
  await filters.getByRole('link', { name: /^공용 보관함 \d+$/ }).click();
  await page.waitForURL('**/boardgames?cabinet=1');
  await expect(page.locator('article').filter({ hasText: renamed })).toHaveCount(1);

  // 다시 빼기(체크 해제는 값이 아예 오지 않는 경우라 따로 확인한다).
  await page.locator('article').filter({ hasText: renamed }).getByRole('link', { name: '수정' }).click();
  await expect(page.getByRole('checkbox', { name: '공용 보관함에 보관' })).toBeChecked();
  await page.getByRole('checkbox', { name: '공용 보관함에 보관' }).uncheck();
  await page.getByRole('button', { name: '수정완료' }).click();
  await page.waitForURL((url) => url.pathname === '/boardgames');
  await expect(page.locator('article').filter({ hasText: renamed })).not.toContainText('공용 보관함');
  expect((await db.select().from(boardGames).where(eq(boardGames.id, row.id)))[0].inSharedCabinet).toBe(false);

  // 삭제(확인 창 수락)
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('article').filter({ hasText: renamed }).getByRole('button', { name: '삭제' }).click();
  await expect(page.locator('article').filter({ hasText: renamed })).toHaveCount(0);
  expect(await db.select().from(boardGames).where(eq(boardGames.id, row.id))).toHaveLength(0);

  await page.context().close();
});

test('보드게임 필터: 카테고리를 고르면 그 카테고리 게임만 나온다', async ({ page }) => {
  await page.goto('/boardgames');
  const filters = page.getByRole('navigation', { name: '보드게임 필터' });
  // 전체·공용 보관함·미분류를 뺀 첫 실제 카테고리
  const categoryLink = filters.getByRole('link').filter({ hasNotText: /^(전체|공용 보관함|미분류) / }).first();
  const label = (await categoryLink.textContent())!.trim();
  const [, category, count] = label.match(/^(.*) (\d+)$/)!;

  await categoryLink.click();
  await page.waitForURL(`**/boardgames?category=${encodeURIComponent(category)}`);
  const cards = page.locator('article');
  await expect(cards).toHaveCount(Number(count));
  for (const card of await cards.all()) {
    // 한 줄 요약("카테고리 · 인원 · 시간")의 맨 앞이 고른 카테고리여야 한다.
    const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(card.locator('p').first()).toHaveText(new RegExp(`^${escaped}( · |$)`));
  }
});

test('목록은 이미지 없이 정보만 보여주고, 비회원에게는 보유자(실명)와 수정·삭제 버튼을 숨긴다', async ({ page, browser }) => {
  await page.goto('/boardgames');
  await expect(page.locator('article').first()).toBeVisible();
  await expect(page.locator('main img')).toHaveCount(0);
  await expect(page.getByText(/보유자/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: '수정' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '삭제' })).toHaveCount(0);

  // 회원에게는 이관 데이터의 보유자가 보인다.
  const memberPage = await loggedInPage(browser, member, '/boardgames');
  await expect(memberPage.getByText(/· 보유자 /).first()).toBeVisible();
  await memberPage.context().close();
});

test('보유자 검색은 회원에게만: 회원은 보유자 이름으로 찾고, 비회원 검색에는 보유자가 쓰이지 않는다', async ({ page, browser }) => {
  // 이관 데이터에서 보유자가 있는 게임 하나와, 그 보유자 이름이 게임 이름에 들어 있지 않은지 확인한다.
  const owned = await db.query.boardGames.findMany({ with: { owner: { columns: { displayName: true, nickname: true } } } });
  const target = owned.find((g) => g.owner?.displayName && !owned.some((o) => o.name.includes(g.owner!.displayName!)))!;
  const ownerName = target.owner!.displayName!;
  // 검색은 부분 일치라 실명·닉네임에 그 이름이 들어간 다른 보유자의 게임도 함께 나온다.
  const expected = owned.filter((g) => g.owner && (g.owner.displayName?.includes(ownerName) || g.owner.nickname.includes(ownerName))).length;

  const memberPage = await loggedInPage(browser, member, `/boardgames?q=${encodeURIComponent(ownerName)}`);
  await expect(memberPage.getByRole('searchbox', { name: '보드게임 검색' })).toHaveValue(ownerName);
  await expect(memberPage.locator('article')).toHaveCount(expected);
  for (const card of await memberPage.locator('article').all()) await expect(card).toContainText(`보유자 `);
  await expect(memberPage.locator('article').filter({ hasText: target.name }).first()).toContainText(`보유자 ${ownerName}`);
  await memberPage.context().close();

  await page.goto(`/boardgames?q=${encodeURIComponent(ownerName)}`);
  await expect(page.getByText('조건에 맞는 보드게임이 없습니다.')).toBeVisible();
  expect(await page.content()).not.toContain(`보유자 ${ownerName}`);
});

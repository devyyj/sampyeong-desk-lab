import { test, expect } from '@playwright/test';
import { cleanupE2EData, createTestUser, db, getUser, loggedInPage, type TestUser } from './helpers';
import { posts, users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * 닉네임·시즌 배지·프로필 팝업 E2E(실제 DB).
 * 아이디는 로그인에만 쓰고, 피드에는 닉네임만 보이며, 실명·부서는 회원이 팝업을 열었을 때만 받아 온다.
 */
const SAVED = '정보가 성공적으로 수정되었습니다.';

let writer: TestUser;
let other: TestUser;

test.beforeAll(async () => {
  writer = await createTestUser('nick', { department: '닉네임팀' });
  other = await createTestUser('nick2');
});

test.afterAll(cleanupE2EData);

test('닉네임: 바꾸면 피드에 닉네임만 보이고, 다른 회원 닉네임(대소문자 무시)은 거부된다', async ({ browser }) => {
  const nickname = `닉${Date.now().toString(36).slice(-6)}`;
  const content = `E2E 닉네임 글 ${Date.now()}`;
  await db.insert(posts).values({ authorId: writer.id, content });

  const page = await loggedInPage(browser, writer, '/mypage');
  // 아이디는 '로그인 아이디'로 읽기 전용, 닉네임 최초값은 아이디.
  await expect(page.getByLabel('로그인 아이디')).toHaveValue(writer.username);
  await expect(page.getByLabel('로그인 아이디')).toBeDisabled();
  await expect(page.getByLabel(/닉네임/)).toHaveValue(writer.username);

  // 다른 회원의 닉네임을 대소문자만 바꿔 써도 같은 닉네임으로 보고 거부한다.
  await page.getByLabel(/닉네임/).fill(other.username.toUpperCase());
  await page.getByRole('button', { name: '정보 수정' }).click();
  await expect(page.getByText('이미 사용 중인 닉네임입니다.')).toBeVisible();
  expect((await getUser(writer.username)).nickname).toBe(writer.username);

  await page.getByLabel(/닉네임/).fill(`  ${nickname}  `);
  await page.getByRole('button', { name: '정보 수정' }).click();
  await expect(page.getByText(SAVED)).toBeVisible();
  expect((await getUser(writer.username)).nickname).toBe(nickname);

  // 본인 닉네임을 그대로 다시 저장하는 것은 중복이 아니다.
  await page.getByRole('button', { name: '정보 수정' }).click();
  await expect(page.getByText(SAVED)).toBeVisible();

  await page.goto('/');
  const article = page.locator('article').filter({ hasText: content });
  await expect(article.getByRole('button', { name: nickname, exact: true })).toBeVisible();
  // 피드 어디에도 아이디가 나오지 않는다(부서도 팝업에서만).
  await expect(page.locator('main')).not.toContainText(writer.username);
  await expect(article).not.toContainText('닉네임팀');

  await page.context().close();
});

test('프로필 팝업: 회원에게는 실명·부서까지, 비회원에게는 닉네임·소개만 보인다', async ({ browser }) => {
  const content = `E2E 팝업 글 ${Date.now()}`;
  await db.update(users).set({ bio: 'E2E 소개글' }).where(eq(users.id, writer.id));
  await db.insert(posts).values({ authorId: writer.id, content });
  const nickname = (await getUser(writer.username)).nickname;

  const memberPage = await loggedInPage(browser, other, '/');
  await memberPage.locator('article').filter({ hasText: content }).getByRole('button', { name: nickname }).click();
  const popup = memberPage.getByRole('dialog', { name: `${nickname} 프로필` });
  await expect(popup).toContainText(writer.displayName);
  await expect(popup).toContainText('닉네임팀');
  await expect(popup).toContainText('E2E 소개글');
  await memberPage.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);

  const guest = await browser.newPage();
  await guest.goto('/');
  // 실명은 페이지 HTML에 미리 실리지 않는다(팝업을 열 때 서버에서 받아 옴).
  expect(await guest.content()).not.toContain(writer.displayName);
  await guest.locator('article').filter({ hasText: content }).getByRole('button', { name: nickname }).click();
  const guestPopup = guest.getByRole('dialog', { name: `${nickname} 프로필` });
  await expect(guestPopup).toContainText('E2E 소개글');
  await expect(guestPopup).not.toContainText(writer.displayName);
  await expect(guestPopup).not.toContainText('닉네임팀');
  await guestPopup.getByRole('button', { name: '닫기' }).click();
  await expect(guestPopup).toHaveCount(0);

  await Promise.all([memberPage.context().close(), guest.close()]);
});

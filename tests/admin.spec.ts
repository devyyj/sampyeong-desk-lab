import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { cleanupE2EData, createTestUser, db, getUser, login, loggedInPage, uniqueName, type TestUser } from './helpers';
import { users } from '../drizzle/schema';

/**
 * 관리자 회원 관리 E2E. 회원가입이 없으므로 계정은 관리자 화면에서만 생긴다.
 * 관리자가 만든/초기화한 계정이 실제 로그인에서 PIN 변경 강제로 이어지는지까지 확인한다.
 */
let admin: TestUser;
let member: TestUser;

test.beforeAll(async () => {
  admin = await createTestUser('admin', { isAdmin: true });
  member = await createTestUser('member', { pin: '8642' });
});

test.afterAll(cleanupE2EData);

test('일반 회원에게는 관리자 메뉴가 없고, 관리자 화면은 404로 숨긴다', async ({ page }) => {
  await login(page, member, '/my');
  await expect(page.getByRole('link', { name: /회원 관리/ })).toHaveCount(0);
  // 회원 탭의 ＋(회원 추가)도 관리자에게만 보이고, 주소로 들어가도 404다.
  await page.goto('/members');
  await expect(page.getByRole('link', { name: '회원 추가' })).toHaveCount(0);
  expect((await page.goto('/members/new'))?.status()).toBe(404);

  const response = await page.goto('/admin/members');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '회원 관리' })).toHaveCount(0);
});

test('관리자: 회원을 생성하면(PIN 비움=1234) 새 회원은 첫 로그인에서 PIN 변경을 강요받는다', async ({ page, browser }) => {
  // 회원 생성은 게시글·보드게임과 같은 방식: 회원 탭의 ＋ → 전체 화면 폼.
  await login(page, admin, '/members');
  await page.getByRole('link', { name: '회원 추가' }).click();
  await page.waitForURL('**/members/new');
  await expect(page.getByRole('heading', { name: '회원 추가' })).toBeVisible();

  const newUsername = uniqueName('created');
  const createForm = page.locator('form').filter({ has: page.getByRole('button', { name: '회원 생성' }) });
  // 아이디 앞뒤 공백은 서버에서 잘라 저장해야 로그인이 된다.
  await createForm.getByLabel('아이디 (사내 ID)').fill(`  ${newUsername}  `);
  await createForm.getByLabel('이름').fill('E2E 신규');
  await createForm.getByLabel('소속 부서(팀)').fill('신규팀');
  await createForm.getByRole('button', { name: '회원 생성' }).click();
  await expect(createForm.getByText(`${newUsername} 회원을 생성했습니다.`)).toBeVisible();

  // 같은 아이디는 다시 만들 수 없다.
  await createForm.getByLabel('아이디 (사내 ID)').fill(newUsername);
  await createForm.getByLabel('이름').fill('중복');
  await createForm.getByLabel('소속 부서(팀)').fill('중복팀');
  await createForm.getByRole('button', { name: '회원 생성' }).click();
  await expect(createForm.getByText('이미 존재하는 아이디입니다.')).toBeVisible();

  // 관리자 화면(MY → 회원 관리) 목록에 '초기 PIN' 상태로 나타난다.
  await page.goto('/my');
  await page.getByRole('link', { name: /회원 관리/ }).click();
  await page.waitForURL('**/admin/members');
  const row = page.getByRole('row').filter({ hasText: newUsername });
  await expect(row).toContainText('E2E 신규');
  await expect(row).toContainText('신규팀');
  await expect(row).toContainText('초기 PIN');

  const created = await getUser(newUsername);
  // 닉네임 최초값은 아이디.
  expect(created).toMatchObject({ username: newUsername, nickname: newUsername, mustChangePin: true, isAdmin: false });

  // 새 회원이 기본 PIN 1234로 로그인하면 PIN 변경 화면으로 간다.
  const context = await browser.newContext();
  const newcomer = await context.newPage();
  await login(newcomer, { username: newUsername, pin: '1234' }, '/', '/change-pin');
  await context.close();
});

test('관리자: PIN 초기화 후 회원은 예전 PIN으로 못 들어오고 새 PIN으로 들어오면 PIN 변경을 강요받는다', async ({ page, browser }) => {
  await login(page, admin, '/admin/members');

  const row = page.getByRole('row').filter({ hasText: member.username });
  await row.getByPlaceholder('1234').fill('9753');
  await row.getByRole('button', { name: 'PIN 초기화' }).click();
  await expect(row.getByText(`${member.username} 회원의 비밀번호를 초기화했습니다.`)).toBeVisible();
  // revalidate된 목록에서 상태가 '초기 PIN'으로 바뀐다.
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: member.username })).toContainText('초기 PIN');

  const context = await browser.newContext();
  const memberPage = await context.newPage();
  await memberPage.goto('/login');
  await memberPage.getByLabel('아이디').fill(member.username);
  await memberPage.getByLabel('비밀번호 (4자리 PIN)').fill(member.pin);
  await memberPage.getByRole('button', { name: '로그인' }).click();
  await expect(memberPage.getByText('아이디 또는 비밀번호가 올바르지 않습니다.')).toBeVisible();

  await login(memberPage, { username: member.username, pin: '9753' }, '/', '/change-pin');
  await context.close();
});

test('관리자 권한은 세션이 아닌 DB로 확인한다: 관리자 해제 즉시 관리자 화면이 404가 된다', async ({ browser }) => {
  const demoted = await createTestUser('demoted', { isAdmin: true });
  const page = await loggedInPage(browser, demoted, '/admin/members');
  await expect(page.getByRole('heading', { name: '회원 관리' })).toBeVisible();

  await db.update(users).set({ isAdmin: false }).where(eq(users.id, demoted.id));

  // 세션 JWT에는 아직 isAdmin=true가 남아 있지만 페이지는 DB를 다시 본다.
  const response = await page.reload();
  expect(response?.status()).toBe(404);
  await page.context().close();
});

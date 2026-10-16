import { test, expect } from '@playwright/test';
import { cleanupE2EData, createTestUser, login, logout, type TestUser } from './helpers';

/**
 * 인증·접근 제어 E2E: 비회원 차단(middleware/route-guard), 로그인·로그아웃,
 * 그리고 관리자가 발급한 PIN을 쓰는 동안 PIN 변경 화면에 가두는 흐름.
 */
const WRONG_LOGIN = '아이디 또는 비밀번호가 올바르지 않습니다.';

let member: TestUser;
let issued: TestUser; // 관리자가 1234가 아닌 PIN으로 초기화해 준 상태의 회원

test.beforeAll(async () => {
  member = await createTestUser('auth');
  issued = await createTestUser('issued', { pin: '2468', mustChangePin: true });
});

test.afterAll(cleanupE2EData);

test('비회원: 보호된 경로는 모두 원래 경로를 기억한 채 로그인 화면으로 보낸다', async ({ page }) => {
  const someId = '00000000-0000-4000-8000-000000000000';
  const protectedPaths = [
    '/mypage',
    '/posts/write',
    '/boardgames/add',
    '/admin/members',
    '/change-pin',
    `/posts/${someId}/edit`,
    `/boardgames/${someId}/edit`,
  ];
  for (const path of protectedPaths) {
    await page.goto(path);
    await expect(page, path).toHaveURL(`/login?redirect=${encodeURIComponent(path)}`);
  }

  // 공개 페이지는 그대로 열린다. ＋ 버튼은 비회원에게도 보이지만 로그인 후 작성 화면으로 돌아오는 주소다.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '피드' })).toBeVisible();
  await expect(page.getByRole('link', { name: '글쓰기' })).toHaveAttribute('href', '/login?redirect=%2Fposts%2Fwrite');
  await page.goto('/boardgames');
  await expect(page.getByRole('link', { name: '보드게임 등록' })).toHaveAttribute('href', '/login?redirect=%2Fboardgames%2Fadd');
  // 비회원 MY 탭에는 로그인 버튼이 있다.
  await page.goto('/my');
  await expect(page.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login?redirect=%2Fmy');
});

test('로그인 실패: 없는 아이디와 틀린 PIN은 같은 메시지로 거부한다', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('아이디').fill('e2e_no_such_user');
  await page.getByLabel('비밀번호 (4자리 PIN)').fill('1111');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByText(WRONG_LOGIN)).toBeVisible();

  await page.getByLabel('아이디').fill(member.username);
  await page.getByLabel('비밀번호 (4자리 PIN)').fill('0000');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByText(WRONG_LOGIN)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('로그인 성공: 원래 가려던 페이지로 이동하고, 로그아웃하면 다시 차단된다', async ({ page }) => {
  // 보호 경로 → 로그인 → 원래 경로 복귀
  await page.goto('/boardgames/add');
  await page.waitForURL('**/login?redirect=%2Fboardgames%2Fadd');
  await page.getByLabel('아이디').fill(member.username);
  await page.getByLabel('비밀번호 (4자리 PIN)').fill(member.pin);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL('**/boardgames/add');
  await expect(page.getByRole('heading', { name: '새 보드게임 등록' })).toBeVisible();

  // 계정 메뉴는 MY 탭에 있다. 일반 회원에게는 관리자 메뉴(회원 관리)가 없다.
  await page.goto('/my');
  await expect(page.getByRole('link', { name: /프로필 편집/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /회원 관리/ })).toHaveCount(0);

  await logout(page);
  await page.goto('/my');
  await expect(page.getByRole('link', { name: '로그인' })).toBeVisible();
  await page.goto('/mypage');
  await expect(page).toHaveURL('/login?redirect=%2Fmypage');
});

test('로그인: 외부 주소로의 redirect 파라미터는 무시하고 홈으로 보낸다(오픈 리다이렉트 차단)', async ({ page, baseURL }) => {
  for (const evil of ['//example.com', 'https://example.com', '/\\example.com']) {
    await page.context().clearCookies();
    await login(page, member, evil, '/');
    expect(new URL(page.url()).origin, evil).toBe(new URL(baseURL!).origin);
  }
});

test('발급 PIN 사용자: PIN을 바꾸기 전에는 PIN 변경 화면에만 머물고, 바꾼 PIN으로만 다시 로그인된다', async ({ page }) => {
  // 원래 가려던 곳(/boardgames) 대신 PIN 변경 화면으로 간다.
  await login(page, issued, '/boardgames', '/change-pin');
  await expect(page.getByRole('heading', { name: '초기 비밀번호를 변경해주세요' })).toBeVisible();

  // 다른 페이지(공개 페이지 포함)로 가도 다시 PIN 변경 화면으로 돌아온다.
  for (const path of ['/', '/boardgames', '/mypage', '/?kind=activity']) {
    await page.goto(path);
    await expect(page, path).toHaveURL('/change-pin');
  }

  const submit = async (newPin: string, confirm: string) => {
    await page.getByLabel('새 비밀번호 (4자리 PIN)').fill(newPin);
    await page.getByLabel('새 비밀번호 확인').fill(confirm);
    await page.getByRole('button', { name: '비밀번호 변경' }).click();
  };

  await submit('1234', '1234');
  await expect(page.getByText('초기 비밀번호(1234)는 사용할 수 없습니다.')).toBeVisible();
  await submit(issued.pin, issued.pin);
  await expect(page.getByText('현재 비밀번호와 다른 비밀번호를 입력해주세요.')).toBeVisible();
  await submit('1357', '1358');
  await expect(page.getByText('새 비밀번호가 일치하지 않습니다.')).toBeVisible();
  await expect(page).toHaveURL('/change-pin');

  await submit('1357', '1357');
  await page.waitForURL((url) => url.pathname === '/');
  // 변경 후에는 PIN 변경 화면에 다시 들어갈 수 없고, 다른 페이지가 열린다.
  await page.goto('/change-pin');
  await expect(page).toHaveURL('/');
  await page.goto('/mypage');
  await expect(page.getByRole('heading', { name: '마이페이지' })).toBeVisible();

  await logout(page);
  // 예전 PIN은 거부되고 새 PIN으로는 PIN 변경 화면 없이 바로 들어간다.
  await page.getByLabel('아이디').fill(issued.username);
  await page.getByLabel('비밀번호 (4자리 PIN)').fill(issued.pin);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByText(WRONG_LOGIN)).toBeVisible();
  await login(page, { username: issued.username, pin: '1357' }, '/boardgames');
});

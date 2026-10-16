import { test, expect } from '@playwright/test';
import { cleanupE2EData, createTestUser, expectImageLoaded, getUser, login, loggedInPage, logout, TEST_IMAGE, type TestUser } from './helpers';

/**
 * 마이페이지 E2E: 프로필(부서·자기소개·사진 실제 업로드) 수정과 PIN 변경.
 */
const SAVED = '정보가 성공적으로 수정되었습니다.';

let member: TestUser;

test.beforeAll(async () => {
  member = await createTestUser('profile', { pin: '3579', department: '원래팀' });
});

test.afterAll(cleanupE2EData);

test('프로필: 부서·자기소개·사진을 바꾸면 저장되고 새로고침 후에도 유지된다', async ({ browser }) => {
  const page = await loggedInPage(browser, member, '/mypage');
  await expect(page.getByRole('heading', { name: '마이페이지' })).toBeVisible();
  await expect(page.getByLabel('소속 부서(팀)')).toHaveValue('원래팀');

  await page.getByLabel('소속 부서(팀)').fill('바뀐팀');
  await page.getByLabel('한 줄 자기소개').fill('E2E 자기소개');
  await page.getByLabel('프로필 사진 변경').setInputFiles(TEST_IMAGE);
  // 파일을 고르면 저장 전에 미리보기(blob URL)로 바로 바뀐다.
  await expect(page.getByRole('img', { name: 'Profile' })).toHaveAttribute('src', /^blob:/);

  await page.getByRole('button', { name: '정보 수정' }).click();
  await expect(page.getByText(SAVED)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('소속 부서(팀)')).toHaveValue('바뀐팀');
  await expect(page.getByLabel('한 줄 자기소개')).toHaveValue('E2E 자기소개');
  const avatar = page.getByRole('img', { name: 'Profile' });
  await expect(avatar).toHaveAttribute('src', new RegExp(`/storage/v1/object/public/avatars/${member.id}/`));
  await expectImageLoaded(avatar);

  const saved = await getUser(member.username);
  expect(saved).toMatchObject({ department: '바뀐팀', bio: 'E2E 자기소개' });

  // 사진 삭제: 저장하면 사진을 설정하지 않은 상태(닉네임 첫 글자)로 돌아간다.
  await page.getByRole('button', { name: '사진 삭제' }).click();
  await expect(page.getByRole('img', { name: 'Profile' })).toHaveCount(0);
  await page.getByRole('button', { name: '정보 수정' }).click();
  await expect(page.getByText(SAVED)).toBeVisible();
  await expect.poll(async () => (await getUser(member.username))?.profileImageUrl).toBeNull();
  await page.reload();
  await expect(page.getByRole('img', { name: 'Profile' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '사진 삭제' })).toHaveCount(0);

  // 회원 탈퇴는 아직 준비 중 안내만 띄운다(데이터가 지워지지 않아야 함). 브라우저 대화상자가 아닌 앱 안의 팝업이다.
  let nativeDialog = false;
  page.on('dialog', (dialog) => {
    nativeDialog = true;
    dialog.dismiss();
  });
  await page.getByRole('button', { name: '회원 탈퇴' }).click();
  const ask = page.getByRole('alertdialog', { name: '정말로 탈퇴하시겠습니까?' });
  await expect(ask).toContainText('이 작업은 되돌릴 수 없습니다.');
  await ask.getByRole('button', { name: '탈퇴' }).click();
  const notice = page.getByRole('alertdialog', { name: '준비 중인 기능입니다.' });
  await notice.getByRole('button', { name: '확인' }).click();
  await expect(notice).toHaveCount(0);
  expect(nativeDialog).toBe(false);
  expect(await getUser(member.username)).toBeTruthy();

  await page.context().close();
});

test('프로필 사진: 1MB가 넘는 사진도 올라간다(Server Action 본문 한도 11MB)', async ({ browser }) => {
  const page = await loggedInPage(browser, member, '/mypage');
  // 기본 한도(1MB)를 넘는 2MB 파일. 서버는 MIME 형식으로 판단하므로 내용은 임의 바이트여도 된다.
  const big = Buffer.alloc(2 * 1024 * 1024, 7);
  await page.getByLabel('프로필 사진 변경').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: big });
  await page.getByRole('button', { name: '정보 수정' }).click();
  await expect(page.getByText(SAVED)).toBeVisible();
  const saved = await getUser(member.username);
  expect(saved.profileImageUrl).toMatch(new RegExp(`/storage/v1/object/public/avatars/${member.id}/[0-9a-f-]{36}\\.png$`));
  await page.context().close();
});

test('PIN 변경: 불일치·초기 PIN은 막고, 바꾼 PIN으로만 다시 로그인된다', async ({ page }) => {
  await login(page, member, '/mypage');
  const submit = page.getByRole('button', { name: '정보 수정' });

  // 확인 칸은 새 PIN을 입력해야 나타나고, 불일치하면 저장 버튼이 잠긴다.
  await expect(page.getByLabel('새 비밀번호 확인')).toHaveCount(0);
  await page.getByLabel('새 비밀번호 (4자리 PIN)').fill('2580');
  await page.getByLabel('새 비밀번호 확인').fill('2581');
  await expect(page.getByText('비밀번호가 일치하지 않습니다.')).toBeVisible();
  await expect(submit).toBeDisabled();

  // 누구나 아는 초기 PIN(1234)으로 되돌리는 것은 서버에서 거부한다.
  await page.getByLabel('새 비밀번호 (4자리 PIN)').fill('1234');
  await page.getByLabel('새 비밀번호 확인').fill('1234');
  await expect(page.getByText('비밀번호가 일치합니다.')).toBeVisible();
  await submit.click();
  await expect(page.getByText('초기 비밀번호(1234)는 사용할 수 없습니다.')).toBeVisible();

  await page.getByLabel('새 비밀번호 (4자리 PIN)').fill('2580');
  await page.getByLabel('새 비밀번호 확인').fill('2580');
  await submit.click();
  await expect(page.getByText(SAVED)).toBeVisible();

  await logout(page);
  await page.getByLabel('아이디').fill(member.username);
  await page.getByLabel('비밀번호 (4자리 PIN)').fill(member.pin);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByText('아이디 또는 비밀번호가 올바르지 않습니다.')).toBeVisible();
  await login(page, { username: member.username, pin: '2580' }, '/mypage');
});

test('초기 PIN 상태여도 마이페이지가 아닌 PIN 변경 화면으로 먼저 보낸다', async ({ page }) => {
  const issued = await createTestUser('profile_issued', { pin: '1234', mustChangePin: true });
  await login(page, issued, '/mypage', '/change-pin');
  await page.goto('/mypage');
  await expect(page).toHaveURL('/change-pin');
});

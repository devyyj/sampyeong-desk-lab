// env를 반드시 가장 먼저 불러온다(src/db가 import 시점에 DATABASE_URL을 읽음).
import './env';
import { expect, type Browser, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { eq, inArray, like } from 'drizzle-orm';
import { db } from '../src/db/index';
import { users, boardGames } from '../drizzle/schema';
import { hashPIN } from '../src/lib/auth-utils';

export { db };

/**
 * E2E는 실제 Supabase(DB·Storage)를 대상으로 돈다(AGENTS.md 5·6번: Mock 없이 실제 부수 효과 검증).
 * 그래서 테스트가 만든 데이터는 반드시 이 접두사로 구분하고 afterAll에서 지운다.
 * LIKE에서 '_'는 한 글자 와일드카드라, 실제 회원을 지우지 않도록 '\_'로 이스케이프한 패턴을 쓴다.
 */
export const E2E_PREFIX = 'e2e_';
const E2E_LIKE = 'e2e\\_%';

export const TEST_IMAGE = path.join(process.cwd(), 'tests', 'fixtures', 'dummy.png');

// 사용자 업로드 버킷. 각 액션은 `${userId}/${uuid}.ext` 경로에 올린다.
const UPLOAD_BUCKETS = ['post_images', 'boardgame_thumbnails', 'avatars'];

let seq = 0;
/**
 * 파일·실행마다 겹치지 않는 아이디. 닉네임 최초값이 아이디이고 닉네임은 20자 제한이라(관리자 회원 생성도
 * 20자 넘는 아이디를 거부) 20자 이내로 만든다: e2e_(4) + 태그 6자 + _ + 시각 6자 + 순번 1~2자.
 */
export function uniqueName(tag: string) {
  return `${E2E_PREFIX}${tag.slice(0, 6)}_${Date.now().toString(36).slice(-6)}${(seq++ % 1296).toString(36)}`.slice(0, 20);
}

export type TestUser = { id: string; username: string; pin: string; displayName: string };

/**
 * 회원가입이 없으므로 테스트 계정은 DB에 직접 만든다.
 * mustChangePin=false가 기본이라 로그인 직후 PIN 변경 화면을 거치지 않는다(PIN 변경 흐름 테스트만 true로 만든다).
 */
export async function createTestUser(
  tag: string,
  opts: { pin?: string; isAdmin?: boolean; mustChangePin?: boolean; department?: string } = {},
): Promise<TestUser> {
  const username = uniqueName(tag);
  const pin = opts.pin ?? '5791';
  const displayName = `E2E ${tag}`;
  const [row] = await db
    .insert(users)
    .values({
      username,
      // 앱의 회원 생성과 같이 닉네임 최초값은 아이디.
      nickname: username,
      pinHash: await hashPIN(pin),
      displayName,
      department: opts.department ?? 'QA',
      isAdmin: opts.isAdmin ?? false,
      mustChangePin: opts.mustChangePin ?? false,
    })
    .returning({ id: users.id });
  return { id: row.id, username, pin, displayName };
}

export async function getUser(username: string) {
  const [row] = await db.select().from(users).where(eq(users.username, username));
  return row;
}

export function adminStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('E2E 정리에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
}

/**
 * e2e_ 계정과 그 계정이 만든 데이터를 모두 지운다.
 * - posts는 author FK가 cascade라 회원 삭제로 함께 지워진다.
 * - board_games.added_by_id는 set null이라 회원을 지우면 게임이 고아로 남으므로 먼저 지운다.
 * - Storage 파일은 DB cascade로 지워지지 않으므로 회원 id 폴더를 버킷마다 직접 비운다.
 */
export async function cleanupE2EData() {
  const testUsers = await db.select({ id: users.id }).from(users).where(like(users.username, E2E_LIKE));
  const ids = testUsers.map((u) => u.id);
  if (ids.length === 0) return;

  await db.delete(boardGames).where(inArray(boardGames.addedById, ids));

  const storage = adminStorage();
  for (const bucket of UPLOAD_BUCKETS) {
    for (const id of ids) {
      const { data } = await storage.from(bucket).list(id);
      if (data && data.length > 0) {
        const { error } = await storage.from(bucket).remove(data.map((f) => `${id}/${f.name}`));
        if (error) console.error(`E2E storage cleanup failed (${bucket}/${id})`, error);
      }
    }
  }

  await db.delete(users).where(inArray(users.id, ids));
}

/** 로그인 폼으로 로그인하고, 도착 URL까지 기다린다(기본: redirect 경로). */
export async function login(page: Page, user: { username: string; pin: string }, redirect = '/', expectUrl?: string) {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
  await page.getByLabel('아이디').fill(user.username);
  await page.getByLabel('비밀번호 (4자리 PIN)').fill(user.pin);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL((url) => url.pathname === (expectUrl ?? redirect.split('?')[0]));
}

/** 사용자별로 쿠키가 섞이지 않도록 독립된 브라우저 컨텍스트에서 로그인한 페이지를 만든다. */
export async function loggedInPage(browser: Browser, user: TestUser, redirect = '/') {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, user, redirect);
  return page;
}

export async function logout(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: '로그아웃' }).click();
  await page.waitForURL('**/login');
}

/** 이미지가 깨지지 않고 실제로 내려받아 디코딩됐는지 확인한다(업로드 + 공개 URL이 실제로 동작하는지). */
export async function expectImageLoaded(img: Locator) {
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 10_000 })
    .toBe(true);
}

/** Storage에 파일이 실제로 있는지(업로드·삭제 정리 검증용, 서비스 키로 확인). */
export async function storageFileExists(bucket: string, path: string) {
  const { data } = await adminStorage().from(bucket).exists(path);
  return data;
}

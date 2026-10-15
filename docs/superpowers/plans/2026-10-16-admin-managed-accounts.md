# 관리자 발급 계정 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원가입을 없애고, 관리자(`youngyong.jo`)가 발급한 계정과 4자리 PIN으로만 로그인하게 하며, 초기 PIN 사용자는 PIN 변경을 강제한다.

**Architecture:** `users.is_admin`/`must_change_pin` 컬럼을 추가하고 로그인 시 세션(JWT)에 담는다. 페이지 이동 제어는 middleware가 세션만 보고 순수 함수 `guardRoute`로 판단한다. 관리자 기능(페이지·액션)은 `getAdminUser()`로 매번 DB를 재확인한다. 이관 회원의 초기 PIN은 1회성 스크립트로 부여한다.

**Tech Stack:** Next.js 16 (App Router, Server Actions, middleware/Edge), Drizzle, jose, bcryptjs, Vitest, Playwright(headless 검증).

**Spec:** `docs/superpowers/specs/2026-10-16-admin-managed-accounts-design.md`

## Global Constraints

- PIN은 정확히 4자리 숫자(`/^\d{4}$/`). 초기 PIN 기본값 `1234`.
- 관리자 계정: `youngyong.jo`.
- Server Action 시그니처는 `(prevState, formData)` (AGENTS.md 3). `redirect()`는 `try` 밖에서 호출한다.
- 세션 값(`isAdmin`, `mustChangePin`)은 화면 분기·이동 제어에만 쓰고, 관리자 권한이 필요한 동작은 항상 DB `is_admin`으로 판단한다.
- 비관리자 액션 응답: `{ error: '권한이 없습니다.' }`. 로그인 실패 메시지는 기존 `'아이디 또는 비밀번호가 올바르지 않습니다.'` 유지.
- `npx tsc --noEmit`: 기존 오류 5건(boardgame/mypage/post 테스트의 SessionPayload) 외 신규 0건. 커밋 전 `npm test` 통과.
- 복잡한 로직에는 "왜"를 설명하는 주석 (AGENTS.md 2).

## Review Focus

1. **세션에는 관리자인데 DB에서 관리자가 해제된 경우** → 관리자 액션·페이지가 거부되어야 한다. (Task 6: 세션 `isAdmin: true` + DB `is_admin: false` → `권한이 없습니다.`)
2. **PIN 변경이 필요한 사용자가 페이지 URL을 직접 입력** → 어떤 페이지든 `/change-pin`으로 가야 한다(쿼리스트링 포함 경로, 중첩 경로 포함). (Task 4)
3. **관리자가 아이디 앞뒤에 공백을 넣어 회원 생성** → 공백 제거 후 저장되어야 로그인이 된다. (Task 6)
4. **PIN 변경 화면에서 초기 PIN(1234)을 그대로 다시 입력** → 거부. (Task 5)
5. **회원 생성 폼에서 초기 PIN 칸을 비워 둠** → 기본값 `1234`로 생성. (Task 6)

---

## File Structure

| 파일 | 책임 |
|---|---|
| `drizzle/schema.ts` (수정) | `isAdmin`, `mustChangePin` 컬럼 |
| `supabase/migrations/0004_*.sql` (생성) | 컬럼 추가 DDL |
| `src/lib/auth-utils.ts` (수정) | `isValidPin`, `INITIAL_PIN` |
| `src/lib/session.ts` (수정) | 세션에 `isAdmin`, `mustChangePin` |
| `src/lib/route-guard.ts` (생성) | middleware 판단 순수 함수 |
| `src/middleware.ts` (수정) | `guardRoute` 사용 |
| `src/lib/admin.ts` (생성) | `getAdminUser()` DB 재확인 |
| `src/app/actions/auth.ts` (수정) | signup 삭제, login 세션 플래그, `changePin` |
| `src/app/actions/admin.ts` (생성) | `createMember`, `resetMemberPin` |
| `src/app/actions/mypage.ts` (수정) | PIN 변경 시 플래그 해제 + 세션 재발급 |
| `src/app/change-pin/page.tsx` (생성) | PIN 변경 강제 화면 |
| `src/app/admin/members/page.tsx`, `AdminMemberForms.tsx` (생성) | 관리자 화면 |
| `src/app/signup/` (삭제) | — |
| `src/components/GNB.tsx`, `src/app/layout.tsx`, `src/app/login/page.tsx` (수정) | 링크 정리, 관리자 메뉴 |
| `scripts/bootstrap-pins.ts` (생성) | 초기 PIN 일괄 부여 + 관리자 지정 |

---

### Task 1: 스키마 컬럼 + PIN 유틸

**Files:**
- Modify: `drizzle/schema.ts`, `drizzle/schema.test.ts`, `src/lib/auth-utils.ts`, `src/lib/auth-utils.test.ts`
- Create: `supabase/migrations/0004_<generated>.sql`

**Interfaces:**
- Produces: `users.isAdmin: boolean`(DB `is_admin`, NOT NULL DEFAULT false), `users.mustChangePin: boolean`(DB `must_change_pin`, NOT NULL DEFAULT false); `isValidPin(pin: unknown): pin is string`; `INITIAL_PIN = '1234'`.

- [ ] **Step 1: 실패하는 테스트**

```ts
// drizzle/schema.test.ts
it('users에 관리자/PIN 변경 필요 플래그(기본 false)', () => {
  expect(column(users, 'is_admin')).toMatchObject({ notNull: true, default: false });
  expect(column(users, 'must_change_pin')).toMatchObject({ notNull: true, default: false });
});
// src/lib/auth-utils.test.ts
it('isValidPin: 4자리 숫자만 true', () => {
  expect(['1234', '0000'].map(isValidPin)).toEqual([true, true]);
  expect(['123', '12345', 'abcd', ' 1234', null, undefined].map(isValidPin)).toEqual([false, false, false, false, false, false]);
  expect(INITIAL_PIN).toBe('1234');
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run drizzle/schema.test.ts src/lib/auth-utils.test.ts` → FAIL
- [ ] **Step 3: 구현** — 컬럼 추가. `isValidPin`은 `typeof pin === 'string' && /^\d{4}$/.test(pin)`이고, `hashPIN` 내부 검증도 이것을 쓴다.
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS
- [ ] **Step 5: 마이그레이션 생성** — `npx drizzle-kit generate --name admin_flags`를 실행한다. 생성 SQL에 `ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL`과 `must_change_pin`이 들어 있는지 확인한다.
- [ ] **Step 6: Commit** — `git commit -m "feat(db): add is_admin and must_change_pin to users"`

---

### Task 2: 세션 플래그 + 로그인

**Files:**
- Modify: `src/lib/session.ts`, `src/lib/session.test.ts`, `src/app/actions/auth.ts`, `src/app/actions/auth.test.ts`

**Interfaces:**
- Consumes: Task 1 컬럼.
- Produces:
  - `type SessionPayload = { userId: string; username: string; isAdmin: boolean; mustChangePin: boolean; expiresAt: Date }`
  - `createSession(userId: string, username: string, flags: { isAdmin: boolean; mustChangePin: boolean }): Promise<void>`
  - `decrypt`는 플래그가 없는 예전 토큰을 `isAdmin: false`, `mustChangePin: false`로 채워 돌려준다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// session.test.ts
it('플래그를 세션에 담고 복원', async () => {
  const token = await encrypt({ userId: '1', username: 'a', isAdmin: true, mustChangePin: true, expiresAt: new Date() });
  expect(await decrypt(token)).toMatchObject({ isAdmin: true, mustChangePin: true });
});
it('플래그 없는 예전 토큰은 false로 해석', async () => {
  const legacy = await new SignJWT({ userId: '1', username: 'a' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(KEY);
  expect(await decrypt(legacy)).toMatchObject({ isAdmin: false, mustChangePin: false });
});
// auth.test.ts (login)
it('로그인 시 DB의 isAdmin/mustChangePin을 세션에 담는다', ...);     // createSession('u1','kim.test',{ isAdmin: true, mustChangePin: false })
it('mustChangePin이면 redirect 값과 무관하게 /change-pin으로', ...); // redirect('/change-pin'), formData redirect='/mypage'
```
`KEY`는 테스트 파일에서 `new TextEncoder().encode('super-secret-key-for-development')`로 만든다(`SESSION_SECRET` 미설정 시 기본값).

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/session.test.ts src/app/actions/auth.test.ts` → 새 테스트 FAIL
- [ ] **Step 3: 구현** — `login` 성공 시 `createSession(user.id, user.username, { isAdmin: user.isAdmin, mustChangePin: user.mustChangePin })`를 호출하고, try 밖에서 `redirect(user.mustChangePin ? '/change-pin' : redirectTo)`를 한다. 기존 `signup` 내부의 `createSession` 호출은 Task 3에서 함수째 삭제하므로, 여기서는 임시로 `{ isAdmin: false, mustChangePin: false }`를 넘긴다.
- [ ] **Step 4: 통과 확인** — PASS, `npx tsc --noEmit` 신규 오류 0
- [ ] **Step 5: Commit** — `git commit -m "feat(auth): carry admin and must-change-pin flags in session"`

---

### Task 3: 회원가입 제거 + GNB 관리자 메뉴

**Files:**
- Delete: `src/app/signup/page.tsx`
- Modify: `src/app/actions/auth.ts`, `src/app/actions/auth.test.ts`, `src/components/GNB.tsx`, `src/components/GNB.test.tsx`, `src/app/layout.tsx`, `src/app/login/page.tsx`, `src/app/login/page.test.tsx`

**Interfaces:**
- Consumes: Task 2 `getSession()`의 `isAdmin`.
- Produces: `GNB({ isLoggedIn, isAdmin }: { isLoggedIn: boolean; isAdmin: boolean })`. `auth.ts`의 export에서 `signup`을 삭제한다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// GNB.test.tsx
it('비로그인: 회원가입 링크 없음', () => { render(<GNB isLoggedIn={false} isAdmin={false} />); expect(screen.queryByText('회원가입')).not.toBeInTheDocument(); });
it('관리자에게만 관리자 메뉴(/admin/members)', () => {
  render(<GNB isLoggedIn isAdmin />);
  expect(screen.getByText('관리자').closest('a')).toHaveAttribute('href', '/admin/members');
});
it('일반 회원에게는 관리자 메뉴 없음', () => { render(<GNB isLoggedIn isAdmin={false} />); expect(screen.queryByText('관리자')).not.toBeInTheDocument(); });
// login/page.test.tsx
it('회원가입 링크가 없다', async () => { /* renderWithSearchParams({}) 후 queryByText('회원가입') null */ });
// auth.test.ts
it('signup은 더 이상 export되지 않는다', async () => { expect('signup' in (await import('./auth'))).toBe(false); });
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/components src/app/login src/app/actions/auth.test.ts` → FAIL
- [ ] **Step 3: 구현**
  - `signup`, 관련 테스트(`describe('signup'...)`, `describe('signup: 사전 등록 계정 연결'...)`), `src/app/signup/`을 삭제한다.
  - GNB의 회원가입 버튼과 로그인 화면의 "계정이 없으신가요? 회원가입" 블록을 삭제한다.
  - 로그인 화면에는 "계정은 관리자에게 문의하세요." 안내 한 줄을 넣는다.
  - layout에서 `isAdmin={!!session?.isAdmin}`을 넘긴다.
- [ ] **Step 4: 통과 확인** — PASS, `grep -rn "signup" src` 결과 0건
- [ ] **Step 5: Commit** — `git commit -m "feat(auth): remove self sign-up; show admin menu to admins"`

---

### Task 4: 라우트 가드 (middleware)

**Files:**
- Create: `src/lib/route-guard.ts`, `src/lib/route-guard.test.ts`
- Modify: `src/middleware.ts`

**Interfaces:**
- Consumes: `SessionPayload`(Task 2).
- Produces: `guardRoute(pathname: string, session: Pick<SessionPayload, 'mustChangePin'> | null): string | null`. 반환값은 리다이렉트할 경로이고, `null`이면 통과다.
  - 판단 순서:
    1. 로그인 필요 경로(`/mypage`, `/posts/write`, `/posts/edit`, `/boardgames/add`, `/boardgames/edit`, `/admin`, `/change-pin`)에 세션이 없으면 `/login?redirect=<encodeURIComponent(pathname)>`
    2. `mustChangePin`이 true이고 경로가 `/change-pin`이 아니면 `/change-pin`
    3. `mustChangePin`이 false이고 경로가 `/change-pin`이면 `/`
    4. 그 외는 `null`
  - 기존 middleware는 `/posts/[id]/edit` 같은 경로를 `startsWith('/posts/edit')`로 검사해서 놓치고 있었다. 이번에 `/posts/<id>/edit`, `/boardgames/<id>/edit` 패턴도 보호한다(정규식 `^/(posts|boardgames)/[^/]+/edit`).

- [ ] **Step 1: 실패하는 테스트** (`route-guard.test.ts`)

```ts
it.each([
  ['/admin/members', null, '/login?redirect=%2Fadmin%2Fmembers'],
  ['/change-pin', null, '/login?redirect=%2Fchange-pin'],
  ['/posts/abc/edit', null, '/login?redirect=%2Fposts%2Fabc%2Fedit'],
  ['/', null, null],
  ['/boardgames', { mustChangePin: true }, '/change-pin'],
  ['/admin/members', { mustChangePin: true }, '/change-pin'],
  ['/change-pin', { mustChangePin: true }, null],
  ['/change-pin', { mustChangePin: false }, '/'],
  ['/mypage', { mustChangePin: false }, null],
])('guardRoute(%s, %o) → %s', (path, session, expected) => {
  expect(guardRoute(path, session)).toBe(expected);
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/route-guard.test.ts` → FAIL
- [ ] **Step 3: 구현** — middleware에서 `decrypt(cookie)` 후 `guardRoute(pathname, session)`을 호출하고, 결과가 있으면 `NextResponse.redirect(new URL(target, req.url))`로 보낸다. 기존 `protectedRoutes` 배열은 `route-guard.ts`로 옮긴다.
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(auth): route guard for login, admin and forced PIN change"`

---

### Task 5: PIN 변경 강제 화면 + 마이페이지 플래그 해제

**Files:**
- Create: `src/app/change-pin/page.tsx`, `src/app/change-pin/page.test.tsx`
- Modify: `src/app/actions/auth.ts`, `src/app/actions/auth.test.ts`, `src/app/actions/mypage.ts`, `src/app/actions/mypage.test.ts`

**Interfaces:**
- Consumes: `isValidPin`(Task 1), `createSession` 플래그(Task 2).
- Produces: `changePin(prevState: unknown, formData: FormData): Promise<{ error: string } | void>`. 폼 필드는 `newPin`, `confirmNewPin`이다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// auth.test.ts — describe('changePin')
it('비로그인이면 오류', ...);                                   // { error: '로그인이 필요합니다.' }
it('4자리 숫자가 아니면 오류', ...);                            // { error: '비밀번호는 4자리 숫자여야 합니다.' }
it('확인 값 불일치 오류', ...);                                 // { error: '새 비밀번호가 일치하지 않습니다.' }
it('현재 PIN과 같으면 거부 (초기 PIN 재사용 방지)', ...);         // verifyPIN → true ⇒ { error: '현재 비밀번호와 다른 비밀번호를 입력해주세요.' }
it('성공: pinHash 갱신 + mustChangePin=false + 세션 재발급 + / 이동', ...);
// → set({ pinHash: 'hashed', mustChangePin: false, ... }), createSession('u1','kim.test',{ isAdmin: false, mustChangePin: false }), redirect('/')
// mypage.test.ts
it('PIN을 바꾸면 mustChangePin=false로 저장하고 세션 재발급', ...);
// change-pin/page.test.tsx
it('새 PIN·확인 입력란과 안내 문구를 렌더링', ...);              // name="newPin", name="confirmNewPin", '초기 비밀번호를 변경해주세요'
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/actions src/app/change-pin` → 새 테스트 FAIL
- [ ] **Step 3: 구현**
  - `changePin`의 사용자 조회는 세션의 `userId`로 한다. 사용자가 없으면 `{ error: '로그인이 필요합니다.' }`를 반환한다.
  - `/change-pin` 페이지는 클라이언트 폼(`useActionState(changePin)`)으로 만든다. 기존 로그인 화면과 같은 카드 스타일을 쓴다.
  - `updateProfile`은 새 PIN이 있으면 `mustChangePin: false`를 함께 저장하고 `createSession`으로 세션을 다시 발급한다(관리자 플래그는 DB 값).
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(auth): forced PIN change page and flag reset"`

---

### Task 6: 관리자 회원 관리

**Files:**
- Create: `src/lib/admin.ts`, `src/lib/admin.test.ts`, `src/app/actions/admin.ts`, `src/app/actions/admin.test.ts`, `src/app/admin/members/page.tsx`, `src/app/admin/members/AdminMemberForms.tsx`, `src/app/admin/members/page.test.tsx`

**Interfaces:**
- Consumes: `getSession`, `isValidPin`, `INITIAL_PIN`, `hashPIN`.
- Produces:
  - `getAdminUser(): Promise<typeof users.$inferSelect | null>`: 세션이 있고 **DB 행의 `isAdmin`이 true**일 때만 사용자를 돌려준다.
  - `createMember(prevState: unknown, formData: FormData): Promise<{ error: string } | { success: string }>`
    - 필드는 `username`, `displayName`, `department`, `pin`(빈 값이면 `INITIAL_PIN`)이다.
    - `username`은 trim한다.
    - 성공 메시지: `'<username> 회원을 생성했습니다.'`
  - `resetMemberPin(prevState: unknown, formData: FormData): Promise<{ error: string } | { success: string }>`
    - 필드는 `userId`, `pin`(빈 값이면 `INITIAL_PIN`)이다.
    - 성공 메시지: `'<username> 회원의 비밀번호를 초기화했습니다.'`
  - 두 액션 모두 `revalidatePath('/admin/members')`, `revalidatePath('/members')`를 호출한다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// admin.test.ts (lib)
it('세션이 관리자라도 DB is_admin=false면 null', ...);          // 세션 isAdmin true, DB 행 isAdmin false
it('DB is_admin=true면 사용자 반환', ...);
it('세션 없으면 null', ...);
// actions/admin.test.ts — getAdminUser를 mock
it('비관리자는 createMember/resetMemberPin 모두 권한 오류', ...);  // { error: '권한이 없습니다.' }, db.insert/update 미호출
it('필수값 누락 오류', ...);                                       // { error: '아이디, 이름, 부서를 모두 입력해주세요.' }
it('PIN 형식 오류', ...);                                          // pin '12a4' ⇒ { error: '비밀번호는 4자리 숫자여야 합니다.' }
it('중복 아이디 오류', ...);                                        // { error: '이미 존재하는 아이디입니다.' }
it('아이디 앞뒤 공백 제거 후 저장', ...);                            // username '  new.user ' ⇒ values({ username: 'new.user', ... })
it('PIN 비우면 1234로, mustChangePin=true로 생성', ...);            // hashPIN('1234') 호출, values({ mustChangePin: true, ... })
it('resetMemberPin: 대상 PIN 갱신 + mustChangePin=true', ...);
it('resetMemberPin: 대상이 없으면 오류', ...);                       // { error: '회원을 찾을 수 없습니다.' }
// admin/members/page.test.tsx
it('관리자가 아니면 notFound()', ...);                              // getAdminUser → null ⇒ notFound 호출
it('관리자면 회원 목록 상태 표시(관리자/초기 PIN/정상)', ...);
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/admin.test.ts src/app/actions/admin.test.ts src/app/admin` → FAIL
- [ ] **Step 3: 구현**
  - 페이지는 서버 컴포넌트로 만든다. `getAdminUser()`가 null이면 `notFound()`를 호출하고, 회원 목록은 username 오름차순이다.
  - 상태 표시 규칙: `isAdmin`이면 `관리자`, `mustChangePin`이면 `초기 PIN`, 그 밖에는 `정상`이다.
  - `AdminMemberForms.tsx`는 클라이언트 컴포넌트로 만들고, 생성 폼과 회원별 PIN 초기화 폼을 담는다(`useActionState`).
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): member creation and PIN reset for admins"`

---

### Task 7: 초기 PIN 부여 스크립트 + DB 적용

**Files:**
- Create: `scripts/bootstrap-pins.ts`, `scripts/bootstrap-pins.test.ts`
- Modify: `package.json` (`"bootstrap:pins": "tsx --env-file=.env.local scripts/bootstrap-pins.ts"`)

**Interfaces:**
- Consumes: 스키마(Task 1), `hashPIN`, `INITIAL_PIN`.
- Produces: `bootstrapPins(db: Db, adminUsername: string): Promise<{ pinsAssigned: number; adminSet: boolean }>`
  - 한 트랜잭션에서 실행한다.
  - `pin_hash IS NULL`인 행에 `pinHash = await hashPIN(INITIAL_PIN)`(해시 1회 생성 후 공유), `mustChangePin = true`를 넣는다.
  - `adminUsername` 행은 `isAdmin = true`로 바꾼다. 갱신된 행이 0개면 `Error('관리자 계정 없음: <username>')`을 던진다.

- [ ] **Step 1: 실패하는 테스트** — fake tx로 다음을 확인한다.
  - PIN 갱신 조건이 `isNull(users.pinHash)`이다(`PgDialect`로 SQL을 렌더링해서 `"pin_hash" is null` 포함 여부를 본다).
  - 관리자 갱신 조건이 `username = 'youngyong.jo'`이다.
  - 관리자 행이 없으면 throw한다.
- [ ] **Step 2: 실패 확인** — `npx vitest run scripts/bootstrap-pins.test.ts` → FAIL
- [ ] **Step 3: 구현** — 진입부에서 `DATABASE_URL`로 db를 만들고 `bootstrapPins(db, 'youngyong.jo')`를 호출한 뒤 결과를 출력한다. 직접 실행 여부는 `process.argv[1]`가 이 파일인지로 판별한다.
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: DB 적용**
  - 0004 SQL을 원격 DB에 적용한다(Supabase MCP `apply_migration`, 실패 시 `DATABASE_URL` 직접 연결).
  - `npm run bootstrap:pins`를 실행한다. 기대 출력은 `pinsAssigned: 53, adminSet: true`이다.
  - 다시 실행해서 `pinsAssigned: 0`이 나오는지 확인한다(재실행 안전성).
- [ ] **Step 6: Commit** — `git commit -m "feat(admin): bootstrap initial PINs and admin account"`

---

### Task 8: 실제 흐름 검증 (dev 서버, headless)

**Files:** 없음 (결과를 이 문서 하단 "실행 기록"에 남긴다)

- [ ] **Step 1** — `npm run dev`
- [ ] **Step 2** — headless 브라우저로 다음 흐름을 확인한다.
  1. `/signup`이 404여야 한다.
  2. `youngyong.jo`/`1234`로 로그인하면 `/change-pin`으로 가야 한다.
  3. `/boardgames`를 직접 입력해도 `/change-pin`으로 돌아와야 한다.
  4. 새 PIN에 `1234`를 넣으면 거부되어야 한다.
  5. 다른 PIN으로 바꾸면 `/`로 가고, GNB에 "관리자"가 보여야 한다.
  6. `/admin/members`에서 `e2e.test` 회원을 PIN 없이 생성한다.
  7. 로그아웃한 뒤 `e2e.test`/`1234`로 로그인하면 `/change-pin`이어야 한다.
  8. `e2e.test`로 `/admin/members`에 가면 404여야 한다.
- [ ] **Step 3: 정리** — `e2e.test` 행을 삭제하고, 관리자 PIN을 `1234` + `must_change_pin=true`로 되돌린다(사용자가 직접 첫 로그인할 수 있도록).
- [ ] **Step 4: 최종 확인** — `npm test`, `npx tsc --noEmit`(신규 0), `npm run build`
- [ ] **Step 5: Commit** — 실행 기록 커밋

---

## 실행 기록

(Task 7 Step 5, Task 8 결과)

### Task 7 — DB 적용 (2026-10-16)
- `0002_admin_flags` 적용(DATABASE_URL 직접 연결): `is_admin`, `must_change_pin` boolean NOT NULL DEFAULT false
- `npm run bootstrap:pins` → `{ pinsAssigned: 53, adminSet: true }`, 재실행 → `{ pinsAssigned: 0, adminSet: true }`

### Task 8 — 실제 흐름 검증 (dev 서버, headless)
- PASS: /signup 404 · 관리자 1234 로그인 → /change-pin · /boardgames 직접 입력 → /change-pin · 초기 PIN 재사용 거부 · PIN 변경 → / · GNB 관리자 메뉴 · 회원 생성(아이디 앞뒤 공백 포함) · 새 회원 1234 로그인 → /change-pin · 새 회원 PIN 변경 → / · 새 회원 관리자 메뉴 없음 · 비관리자 /admin/members 404
- 첫 실행 실패 2건은 검증 스크립트 결함(로그인 상태 GNB의 로그아웃 submit 버튼을 클릭, 리다이렉트 완료 전 다음 단계 진행)이었고 앱 결함 아님 → 선택자를 `main` 범위로, URL 변경 대기로 수정 후 전 항목 통과
- 정리: 테스트 회원 삭제, 관리자 PIN `1234` + `must_change_pin=true`로 원복
- `npm test` 26 files / 139 tests, `npm run build` 성공, `tsc --noEmit` 기존 오류 5건 외 0건

# Confluence → DB 마이그레이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수집해 둔 Confluence 원본(`data/confluence/pages.json` + 첨부 이미지)을 파싱해 Supabase DB/Storage로 1회성(재실행 가능) 이관하고, 사전 등록 계정을 가입 시 연결(claim)한다.

**Architecture:** 스키마를 확장(Drizzle)하고 Storage/RLS를 SQL 마이그레이션으로 만든다. `scripts/import-confluence/`의 **순수 파서**(HTML → 레코드)가 정규화 JSON을 만들고, `images.ts`가 sharp로 최적화·업로드하고, `load.ts`가 한 트랜잭션으로 upsert한다. 앱 코드는 `signup`/`login`/`/members`만 최소 변경한다.

**Tech Stack:** Next.js 16, Drizzle ORM(postgres-js), Supabase Storage(supabase-js, service role — 스크립트 전용), linkedom, turndown, sharp, tsx, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-15-confluence-db-migration-design.md`

## Global Constraints

- Service Role Key(`SUPABASE_SERVICE_ROLE_KEY`)는 `scripts/` 안에서만 사용. `src/`에서 import 금지.
- 개인정보 원본(`data/`, `docs/confluence/`)은 git에 넣지 않는다(이미 gitignore). 테스트 fixture는 **가짜 이름/ID로 익명화**한 인라인 HTML 문자열만 쓴다.
- 이미지: 긴 변 최대 1600px(확대 안 함), WebP 품질 80, 메타데이터(EXIF) 제거.
- 버킷: `activity_photos` = private, `document_images` = public.
- `activities.type` ∈ `ESCAPE_ROOM | REGULAR | LUNCH | EVENING | OTHER`, 분류 우선순위 `방탈출 → 정기 → 점심 → 저녁`.
- 사전 등록 사용자 upsert는 `pin_hash`를 절대 갱신하지 않는다.
- `--reset`은 `--yes` 없이는 실행 거부.
- Unknown User(`링크 텍스트가 "Unknown User"로 시작`)는 사용자/명부로 이관하지 않는다.
- Server Action 시그니처는 `(prevState, formData)` 유지 (AGENTS.md 3).
- 커밋 전 `npx tsc --noEmit` 통과 (AGENTS.md 8). 복잡한 로직에는 "왜"를 설명하는 주석 (AGENTS.md 2).
- 스크립트 테스트 파일 상단에 `// @vitest-environment node`.

## Review Focus

1. **회원이 가입한 뒤 import를 재실행** → 그 사람의 PIN이 유지되어야 한다. (Task 9: `pinHash`가 update set에 없음을 검증)
2. **같은 사전 등록 ID로 두 사람이 동시에 가입** → 한 명만 성공하고 나머지는 "이미 존재하는 아이디" 오류. (Task 2: UPDATE가 0행이면 오류)
3. **사진이나 비고가 없는 활동 행** → `photos: []`, `noteMd: null`이 되고 죽지 않아야 한다. (Task 6)
4. **보유 현황에 같은 이름·같은 보유자의 게임이 중복** → unique 위반으로 죽지 않고 하나로 합친 뒤 리포트한다. (Task 5)
5. **본문이 참조하는 사진 파일이 로컬에 없음** → 해당 사진만 건너뛰고 리포트한다. 전체 import는 계속한다. (Task 8)

---

## File Structure

| 파일 | 책임 |
|---|---|
| `drizzle/schema.ts` (수정) | users/board_games 컬럼 추가, 신규 5개 테이블 |
| `supabase/migrations/0001_<generated>.sql` (생성) | drizzle-kit 생성 DDL |
| `supabase/migrations/0002_confluence_storage_rls.sql` (생성) | 버킷 2개 + RLS 활성화 |
| `src/app/actions/auth.ts` (수정) | claim 분기, 미가입 로그인 거부 |
| `src/app/members/page.tsx` (수정) | 가입자만 표시 |
| `scripts/import-confluence/types.ts` | 공용 타입 |
| `scripts/import-confluence/parse/html.ts` | HTML 파싱, 표 행/셀 추출, Markdown 변환 |
| `scripts/import-confluence/parse/people.ts` | 멘션 파싱, 사람 목록 수집 |
| `scripts/import-confluence/parse/members.ts` | 시즌, 시즌 명부 |
| `scripts/import-confluence/parse/boardgames.ts` | 보유 현황 + 보관함 병합 |
| `scripts/import-confluence/parse/activities.ts` | 활동 행 |
| `scripts/import-confluence/parse/documents.ts` | 회칙, 보관함 안내 |
| `scripts/import-confluence/normalize.ts` | 페이지 목록 → `Normalized` |
| `scripts/import-confluence/images.ts` | 최적화, 업로드, 버킷 비우기, 로컬 파일 확인 |
| `scripts/import-confluence/load.ts` | reset + 트랜잭션 upsert |
| `scripts/import-confluence/index.ts` | CLI(`--dry-run`, `--reset --yes`), 리포트 |

---

### Task 1: 스키마 확장 + 마이그레이션 + 도구 설정

**Files:**
- Modify: `drizzle/schema.ts`, `package.json`
- Create: `drizzle/schema.test.ts`, `supabase/migrations/0002_confluence_storage_rls.sql`, 생성된 `supabase/migrations/0001_*.sql`

**Interfaces:**
- Produces (Drizzle export): `users.displayName`, nullable `users.pinHash`; `boardGames.category | ownerId | note | inSharedCabinet | sourceKey`; 테이블 `seasons`, `seasonMembers`, `activities`, `activityPhotos`, `documents`(컬럼은 스펙 3.2 그대로, camelCase TS 이름 / snake_case DB 이름). relations: `activities.season`, `activities.photos`, `seasonMembers.user`, `boardGames.owner`.

- [ ] **Step 1: 도구 설정**
  - `npm i -D sharp tsx linkedom turndown @types/turndown`
  - `package.json` scripts에 `"test": "vitest run"`, `"import:confluence": "tsx --env-file=.env.local scripts/import-confluence/index.ts"` 추가.

- [ ] **Step 2: 실패하는 스키마 테스트 작성** (`drizzle/schema.test.ts`, `getTableConfig` from `drizzle-orm/pg-core`)

```ts
it('users.pin_hash는 사전 등록을 위해 nullable', () => {
  const col = getTableConfig(users).columns.find(c => c.name === 'pin_hash')!;
  expect(col.notNull).toBe(false);
});
it('신규 테이블과 멱등성 키가 존재', () => {
  expect(getTableConfig(activities).columns.find(c => c.name === 'source_key')!.isUnique).toBe(true);
  expect(getTableConfig(boardGames).columns.find(c => c.name === 'source_key')!.isUnique).toBe(true);
  expect(getTableConfig(boardGames).columns.find(c => c.name === 'in_shared_cabinet')!.default).toBe(false);
  expect(getTableConfig(seasonMembers).primaryKeys[0].columns.map(c => c.name)).toEqual(['season_id', 'user_id']);
  expect(getTableConfig(activityPhotos).uniqueConstraints[0].columns.map(c => c.name)).toEqual(['activity_id', 'position']);
});
```

- [ ] **Step 3: 실패 확인** — `npx vitest run drizzle/schema.test.ts` → FAIL(`activities` 등 import 불가)

- [ ] **Step 4: 스키마 구현** (스펙 3.1/3.2). `seasons.id`는 `integer().primaryKey()`(serial 아님: 시즌 번호를 그대로 쓰기 위함), `activities.date`는 `date('date', { mode: 'string' })`.

- [ ] **Step 5: 통과 확인** — 위 명령 PASS, `npx tsc --noEmit`에서 schema 관련 오류 0. (`auth.ts`의 `verifyPIN(pin, user.pinHash)` nullable 타입 오류는 Task 2에서 해결되므로 여기서는 그 1건만 허용)

- [ ] **Step 6: 마이그레이션 생성/작성**
  - `npx drizzle-kit generate --name confluence_import` → `supabase/migrations/0001_confluence_import.sql` 생성. 내용에 `ALTER COLUMN "pin_hash" DROP NOT NULL`과 `CREATE TABLE "activities"`가 있는지 확인. (번호가 기존 수동 파일 `0001_storage_rls.sql`과 겹치지만 drizzle journal 기준이라 정상.)
  - `0002_confluence_storage_rls.sql` 직접 작성: 신규 5개 테이블 `ENABLE ROW LEVEL SECURITY`(정책 없음), `INSERT INTO storage.buckets (id,name,public) VALUES ('activity_photos','activity_photos',false),('document_images','document_images',true) ON CONFLICT (id) DO NOTHING;`, `document_images`에 public SELECT 정책만 추가. 파일 상단 주석에 "activity_photos는 의도적으로 정책 없음: service role 업로드 + signed URL 조회"라고 적는다.

- [ ] **Step 7: Commit** — `git add drizzle/ supabase/migrations/ package.json package-lock.json && git commit -m "feat(db): extend schema for Confluence import"`

---

### Task 2: 가입 연결(claim)과 미가입 로그인 거부

**Files:**
- Modify: `src/app/actions/auth.ts`, `src/app/actions/auth.test.ts`, `src/app/members/page.tsx`

**Interfaces:**
- Consumes: Task 1의 nullable `users.pinHash`.
- Produces: 없음(기존 `signup`/`login` 시그니처 유지).

- [ ] **Step 1: 실패하는 테스트 추가** (`auth.test.ts`; db mock에 `update`, `set` 추가하고 `where`가 체이닝/종단 둘 다 되도록 조정)

```ts
it('pin_hash가 NULL인 사전 등록 계정이면 UPDATE로 연결하고 세션 생성', async () => {
  // select → [{ id:'u1', username:'kim.test', pinHash:null }], update...returning → [{ id:'u1', username:'kim.test' }]
  await signup(null, fd({ username:'kim.test', pin:'1234', confirmPin:'1234', department:'개발팀' }));
  expect(db.insert).not.toHaveBeenCalled();
  expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ pinHash: 'hashed', department: '개발팀' }));
  expect(session.createSession).toHaveBeenCalledWith('u1', 'kim.test');
});
it('UPDATE가 0행이면(동시 가입 경합) 이미 존재 오류', async () => {
  // select → [{ pinHash:null }], returning → []
  expect(await signup(null, fd(...))).toEqual({ error: '이미 존재하는 아이디입니다.' });
  expect(session.createSession).not.toHaveBeenCalled();
});
it('pin_hash가 있는 계정이면 기존처럼 이미 존재 오류', ...);
it('login: pin_hash가 NULL이면 일반 인증 실패 메시지, verifyPIN 미호출', async () => {
  expect(await login(null, fd({ username:'kim.test', pin:'1234' }))).toEqual({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  expect(authUtils.verifyPIN).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/actions/auth.test.ts` → 새 4개 FAIL

- [ ] **Step 3: 구현**
  - `signup`: 기존 사용자가 있고 `pinHash === null`이면 `db.update(users).set({ pinHash, department, updatedAt: new Date() }).where(and(eq(users.username, username), isNull(users.pinHash))).returning()`을 실행한다. 결과가 0행이면 오류, 1행이면 세션을 만든다. `WHERE`에 `isNull`을 넣은 이유(경합 방지)를 주석으로 남긴다.
  - `login`: `if (!user || !user.pinHash)`이면 같은 오류를 낸다.
  - `/members`: `findMany({ where: isNotNull(users.pinHash), ... })`로 바꾸고, "시즌 명부 UI 전까지 임시"라는 주석을 단다.

- [ ] **Step 4: 통과 확인** — auth 테스트 전체 PASS, `npx tsc --noEmit` 오류 0

- [ ] **Step 5: Commit** — `git commit -m "feat(auth): claim pre-registered accounts on signup"`

---

### Task 3: 공용 타입 + HTML/Markdown 헬퍼

**Files:**
- Create: `scripts/import-confluence/types.ts`, `scripts/import-confluence/parse/html.ts`, `scripts/import-confluence/parse/html.test.ts`

**Interfaces:**
- Produces (`types.ts`):

```ts
export type ConfluencePage = { id: string; title: string; parents: { id: string; title: string }[]; html: string };
export type Mention = { username: string; displayName: string | null; department: string | null; unknown: boolean };
export type Person = { username: string; displayName: string; department: string };
export type ParsedSeason = { id: number; name: string; period: string };
export type ParsedSeasonMember = { seasonId: number; username: string; role: string | null; note: string | null };
export type ParsedBoardGame = { sourceKey: string; name: string; category: string | null; recommendedPlayers: string | null; ownerUsername: string | null; note: string | null; inSharedCabinet: boolean };
export type ActivityType = 'ESCAPE_ROOM' | 'REGULAR' | 'LUNCH' | 'EVENING' | 'OTHER';
export type ParsedPhoto = { pageId: string; fileName: string; position: number };
export type ParsedActivity = { sourceKey: string; seasonId: number; date: string; type: ActivityType; title: string; bodyMd: string; noteMd: string | null; photos: ParsedPhoto[] };
export type ParsedDocument = { slug: 'rules' | 'shared-cabinet'; title: string; bodyMd: string; sourcePageId: string; images: { pageId: string; fileName: string }[] };
export type ImportReport = { skippedUnknownUsers: string[]; cabinetUnmatched: string[]; duplicateGames: string[]; missingFiles: string[] };
export type Normalized = { people: Person[]; seasons: ParsedSeason[]; seasonMembers: ParsedSeasonMember[]; boardGames: ParsedBoardGame[]; activities: ParsedActivity[]; documents: ParsedDocument[]; report: ImportReport };
```

- Produces (`html.ts`):
  - `parseFragment(html: string): HTMLElement`: linkedom으로 파싱한 컨테이너 요소.
  - `tableRows(root: Element): Element[][]`: 첫 표의 **헤더를 제외한** 각 행 셀 배열. `numberingColumn` 셀은 제외한다.
  - `attachmentName(src: string): string | null`: `/download/(attachments|thumbnails)/…/<name>?…`에서 디코드한 파일명. 첨부가 아니면 `null`.
  - `toMarkdown(node: Element, opts?: { image?: (fileName: string, alt: string) => string }): string`
    - turndown 설정: atx, `-` bullet, 목록 기호 뒤 공백 1칸으로 정규화.
    - `<time datetime>`은 datetime 값으로 바꾼다.
    - `button`, `.hidden`, `.plugin_pagetree`, `.toc-macro`는 제거한다.
    - 이모티콘 `img`는 alt 텍스트로 바꾼다.
    - 첨부 `img`는 `opts.image`가 있으면 그 결과로, 없으면 제거한다.
    - 사용자 멘션은 링크 텍스트만 남긴다.

- [ ] **Step 1: 실패하는 테스트** (`html.test.ts`, 익명 fixture)

```ts
it('tableRows는 헤더 행과 번호 열을 제외', () => {
  const rows = tableRows(parseFragment('<table><tbody><tr><th class="numberingColumn"></th><th>A</th></tr><tr><td class="numberingColumn">1</td><td>x</td></tr></tbody></table>'));
  expect(rows.map(r => r.map(c => c.textContent))).toEqual([['x']]);
});
it('attachmentName은 embedded-page 경로와 쿼리 처리', () => {
  expect(attachmentName('https://h/download/attachments/embedded-page/~a/%EC%8B%9C%EC%A6%8C/image-1.png?api=v2')).toBe('image-1.png');
  expect(attachmentName('/images/icons/emoticons/smile.svg')).toBeNull();
});
it('toMarkdown: time→datetime, button 제거, 멘션은 텍스트, 이미지 콜백', () => {
  const md = toMarkdown(parseFragment('<p><time datetime="2026-01-02">2일</time><button>활동 사진</button><a class="confluence-userlink" data-username="kim.test">김테스트/개발팀</a><img src="/download/attachments/1/a.png"></p>'), { image: (f) => `[[${f}]]` });
  expect(md).toBe('2026-01-02김테스트/개발팀[[a.png]]');
});
it('toMarkdown: 목록 기호 뒤 공백 1칸', () => {
  expect(toMarkdown(parseFragment('<ul><li>a<ul><li>b</li></ul></li></ul>'))).toBe('- a\n    - b');
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run scripts/import-confluence/parse/html.test.ts` → FAIL
- [ ] **Step 3: 구현** (위 시그니처)
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(import): add HTML/markdown parse helpers"`

---

### Task 4: 사람, 시즌, 시즌 명부 파서

**Files:**
- Create: `scripts/import-confluence/parse/people.ts`, `parse/members.ts`, `parse/people.test.ts`, `parse/members.test.ts`

**Interfaces:**
- Consumes: Task 3의 `parseFragment`, `tableRows`, 타입들.
- Produces:
  - `parseMention(a: Element): Mention`
    - `username`은 `data-username`에서 가져온다.
    - 텍스트가 `Unknown User`로 시작하면 `unknown: true`, displayName과 department는 `null`이다.
    - 그 밖에는 첫 `/` 기준으로 앞은 displayName, 뒤는 department다.
  - `parseSeasonTitle(title: string): ParsedSeason | null`: `시즌 5 (26년 4분기)🎄` → `{ id: 5, name: '시즌 5', period: '26년 4분기' }`.
  - `parseRosterTitle(title: string): number | null`: `시즌 3 회원 명부` → `3`.
  - `parseRoster(seasonId: number, html: string): { members: ParsedSeasonMember[]; mentions: Mention[]; skippedUnknown: string[] }`
  - `collectPeople(mentionsInPriorityOrder: Mention[]): Person[]`
    - Unknown은 제외한다.
    - 같은 username이 여러 번 나오면 **먼저 나온 값**(최신 시즌 우선)을 쓴다.
    - 호출하는 쪽(Task 7)은 시즌 5 → 1 명부, 그다음 보드게임 보유자 순서로 넘긴다.

- [ ] **Step 1: 실패하는 테스트**

```ts
it('parseMention: 이름/부서 분리, 부서 내 공백 유지', () => {
  expect(parseMention(a('kim.test', '김테스트/SaaS개발 TF'))).toEqual({ username: 'kim.test', displayName: '김테스트', department: 'SaaS개발 TF', unknown: false });
});
it('parseMention: Unknown User', () => {
  expect(parseMention(a('gone.user', 'Unknown User (gone.user)')).unknown).toBe(true);
});
it('parseRoster: 회장 추출(헤딩 안에 있어도), 나머지 원문은 note, 빈 비고는 null, Unknown 제외', () => {
  const r = parseRoster(5, rosterHtml([['kim.test','김테스트/A팀','<h1>👨‍🍼회장</h1>'], ['lee.test','이테스트/B팀','💎'], ['park.test','박테스트/C팀','<br/>'], ['gone.user','Unknown User (gone.user)','']]));
  expect(r.members).toEqual([
    { seasonId: 5, username: 'kim.test', role: '회장', note: '👨‍🍼' },
    { seasonId: 5, username: 'lee.test', role: null, note: '💎' },
    { seasonId: 5, username: 'park.test', role: null, note: null },
  ]);
  expect(r.skippedUnknown).toEqual(['gone.user']);
});
it('collectPeople: 먼저 나온 부서 우선, Unknown 제외', ...);
it('parseSeasonTitle / parseRosterTitle', ...);
```

- [ ] **Step 2: 실패 확인** — `npx vitest run scripts/import-confluence/parse/people.test.ts scripts/import-confluence/parse/members.test.ts` → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(import): parse people, seasons and rosters"`

---

### Task 5: 보드게임 파서 (보유 현황 + 공용 보관함)

**Files:**
- Create: `scripts/import-confluence/parse/boardgames.ts`, `parse/boardgames.test.ts`

**Interfaces:**
- Consumes: `parseFragment`, `tableRows`, `parseMention`.
- Produces:
  - `normalizeGameName(name: string): string`: 소문자로 바꾸고 `\p{L}\p{N}`가 아닌 문자를 모두 제거한다.
  - `parseBoardGames(inventoryHtml: string, cabinetHtml: string): { games: ParsedBoardGame[]; ownerMentions: Mention[]; cabinetUnmatched: string[]; duplicateGames: string[] }`
    - 보유 현황 열 순서: [이름, 카테고리, 플레이 인원, 보유자, 비고].
    - 보관함 열 순서: [이름, 소유자, 비고]. 보관함 표는 `cabinetHtml`의 마지막 표다.
    - `sourceKey`는 `${normalizeGameName(name)}:${owner username}`이다. 보유자가 없으면 `:none`을 붙인다.
    - 빈 셀(공백, `&nbsp;`)은 `null`이다.
    - Unknown 보유자는 `ownerUsername: null`로 두되, sourceKey에는 원래 ID를 쓴다.

- [ ] **Step 1: 실패하는 테스트**

```ts
it('보관함 게임을 정규화 이름+소유자로 매칭해 inSharedCabinet=true', () => {
  const { games, cabinetUnmatched } = parseBoardGames(inv([['한밤의 늑대인간','마피아','','kim.test','']]), cab([['한밤의 늑대 인간','kim.test','']]));
  expect(games).toHaveLength(1);
  expect(games[0]).toMatchObject({ name: '한밤의 늑대인간', category: '마피아', recommendedPlayers: null, ownerUsername: 'kim.test', inSharedCabinet: true, sourceKey: '한밤의늑대인간:kim.test' });
  expect(cabinetUnmatched).toEqual([]);
});
it('매칭 실패한 보관함 게임은 새 게임으로 추가하고 리포트', () => {
  const r = parseBoardGames(inv([]), cab([['코드네임','lee.test','']]));
  expect(r.games[0]).toMatchObject({ name: '코드네임', category: null, inSharedCabinet: true });
  expect(r.cabinetUnmatched).toEqual(['코드네임 (lee.test)']);
});
it('보유 현황 내 같은 이름·보유자 중복은 하나로 합치고 리포트', () => {
  const r = parseBoardGames(inv([['루미큐브','숫자','2명 ~ 4명','kim.test',''], ['루미 큐브','숫자','','kim.test','']]), cab([]));
  expect(r.games).toHaveLength(1);
  expect(r.duplicateGames).toEqual(['루미 큐브 (kim.test)']);
});
it('Unknown 보유자는 ownerUsername null, sourceKey에는 원 ID', ...);
```

- [ ] **Step 2: 실패 확인** — `npx vitest run scripts/import-confluence/parse/boardgames.test.ts` → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(import): parse board games and shared cabinet"`

---

### Task 6: 활동 파서

**Files:**
- Create: `scripts/import-confluence/parse/activities.ts`, `parse/activities.test.ts`

**Interfaces:**
- Consumes: `parseFragment`, `tableRows`, `attachmentName`, `toMarkdown`.
- Produces:
  - `classifyActivity(title: string): ActivityType`
  - `parseActivities(page: ConfluencePage, seasonId: number): ParsedActivity[]`
    - 행 셀 순서: [날짜, 내용, 비고].
    - `date`는 `time[datetime]`에서 가져온다. 없으면 `Error("<pageId> row <n>: date missing")`를 던진다.
    - `title`은 내용 셀에서 첫 최상위 `li`의 **자기 텍스트**다(하위 `ul` 제외, 앞뒤 공백 정리). `li`가 없으면 내용 셀 텍스트의 첫 줄이다.
    - `bodyMd`는 `toMarkdown(내용 셀)`로 만들며, 이미지는 제거한다.
    - `noteMd`는 `toMarkdown(비고 셀)`로 만들며, 이미지는 제거하고 결과가 비면 `null`이다.
    - `photos`는 내용 셀 → 비고 셀 순서로 모은 첨부 `img`이고, `position`은 0부터 시작한다.
    - `sourceKey`는 `${page.id}:${행 번호(1부터)}`다.

- [ ] **Step 1: 실패하는 테스트**

```ts
it('classifyActivity 우선순위', () => {
  expect(classifyActivity('제 6회 방탈출 정기모임')).toBe('ESCAPE_ROOM');
  expect(classifyActivity('제 3회 보드게임 정기모임')).toBe('REGULAR');
  expect(classifyActivity('점심 전략 연구')).toBe('LUNCH');
  expect(classifyActivity('저녁 연구')).toBe('EVENING');
  expect(classifyActivity('번개')).toBe('OTHER');
});
it('행 파싱: 제목, 날짜, 사진 순서, 비고에서 버튼·이미지 제거', () => {
  const [a] = parseActivities(page('p1', row('2025-12-19', '<ul><li><strong>제 2회 방탈출 정기모임</strong></li><li>인원 : 4명</li></ul>', '<div class="expand-container"><button>활동 사진</button><img src="/download/attachments/x/b.png"><img src="/download/attachments/x/a.png"></div><ul><li>후기</li></ul>')), 1);
  expect(a).toMatchObject({ sourceKey: 'p1:1', seasonId: 1, date: '2025-12-19', type: 'ESCAPE_ROOM', title: '제 2회 방탈출 정기모임', noteMd: '- 후기' });
  expect(a.bodyMd).toBe('- **제 2회 방탈출 정기모임**\n- 인원 : 4명');
  expect(a.photos).toEqual([{ pageId: 'p1', fileName: 'b.png', position: 0 }, { pageId: 'p1', fileName: 'a.png', position: 1 }]);
});
it('사진/비고 없는 행 → photos [], noteMd null', ...);
it('하위 목록이 있는 li에서 제목은 자기 텍스트만', () => { /* '<ul><li>점심 연구<ul><li>5명</li></ul></li></ul>' → title '점심 연구' */ });
it('date 없는 행은 페이지/행 정보를 담아 throw', ...);
```

- [ ] **Step 2: 실패 확인** — `npx vitest run scripts/import-confluence/parse/activities.test.ts` → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(import): parse activity records"`

---

### Task 7: 문서 파서 + normalize

**Files:**
- Create: `scripts/import-confluence/parse/documents.ts`, `parse/documents.test.ts`, `scripts/import-confluence/normalize.ts`, `scripts/import-confluence/normalize.test.ts`

**Interfaces:**
- Consumes: Task 3~6의 모든 파서.
- Produces:
  - `IMG_PLACEHOLDER = (fileName: string) => \`{{img:${fileName}}}\``: load 단계에서 public URL로 치환한다.
  - `parseDocument(slug: 'rules' | 'shared-cabinet', page: ConfluencePage): ParsedDocument`
    - `rules`는 전체 본문이다.
    - `shared-cabinet`은 텍스트에 `보관중인 게임 목록`이 들어간 헤딩부터 그 뒤 형제 요소를 모두 제거한 본문이다.
    - 이미지는 `![alt](${IMG_PLACEHOLDER(file)})`로 바꾸고, 같은 파일을 `images`에 순서대로 기록한다.
  - `normalize(pages: ConfluencePage[]): Normalized`
    - 페이지는 제목 패턴으로 찾는다.
      - 활동 페이지: `parseSeasonTitle`로 매칭한다.
      - 명부 페이지: `parseRosterTitle`로 매칭한다.
      - 보유 현황은 제목이 `보드 게임 보유 현황`으로, 보관함은 `공용 보드 게임 보관함`으로, 회칙은 `회칙`으로 시작하는 페이지다.
    - 필수 페이지가 없으면 throw한다.
    - `collectPeople`에는 명부를 시즌 내림차순으로 넘긴 다음, 보드게임 보유자를 넘긴다.
    - report 항목들을 합친다.

- [ ] **Step 1: 실패하는 테스트**

```ts
it('shared-cabinet은 게임 목록 섹션 이후를 제거하고 이미지 placeholder 기록', () => {
  const d = parseDocument('shared-cabinet', page('c1', '<h1>1. 위치</h1><p><img src="/download/attachments/c1/m.png"></p><h1>3. 보관중인 게임 목록</h1><table>…</table>'));
  expect(d.bodyMd).toBe('# 1. 위치\n\n![]({{img:m.png}})');
  expect(d.images).toEqual([{ pageId: 'c1', fileName: 'm.png' }]);
});
it('rules는 목차 매크로 제거', ...);
it('normalize: 최소 페이지 세트(익명 fixture)로 각 배열 건수와 people 우선순위', () => {
  const n = normalize(minimalPages()); // 시즌1·2 활동, 시즌1·2 명부(같은 사람의 부서가 시즌마다 다름), 보유 현황, 보관함, 회칙
  expect(n.seasons.map(s => s.id)).toEqual([1, 2]);
  expect(n.people.find(p => p.username === 'kim.test')!.department).toBe('시즌2부서');
});
it('normalize: 필수 페이지 누락 시 throw', ...);
```

- [ ] **Step 2: 실패 확인** — `npx vitest run scripts/import-confluence/parse/documents.test.ts scripts/import-confluence/normalize.test.ts` → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(import): parse documents and normalize all pages"`

---

### Task 8: 이미지 최적화와 Storage 헬퍼

**Files:**
- Create: `scripts/import-confluence/images.ts`, `scripts/import-confluence/images.test.ts`

**Interfaces:**
- Produces:
  - `optimizeImage(input: Buffer): Promise<Buffer>`: `sharp(input).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()`. `rotate()`는 메타데이터를 지우기 전에 EXIF 방향을 반영하려고 넣는다(주석으로 남긴다).
  - `resolveLocalFile(attachmentsDir: string, pageId: string, fileName: string): string | null`: 파일이 없으면 `null`.
  - `activityPhotoPath(seasonId: number, sourceKey: string, position: number): string`: 결과는 `${seasonId}/${sourceKey.replace(':', '_')}/${position}.webp`이다. Storage 키에 `:`을 쓰지 않으려고 `_`로 바꾼다.
  - `documentImagePath(slug: string, index: number): string`: 결과는 `${slug}/${index}.webp`이다.
  - `uploadImage(storage: StorageLike, bucket: string, path: string, data: Buffer): Promise<void>`: `upload(path, data, { contentType: 'image/webp', upsert: true })`를 호출하고, 오류가 나면 throw한다.
  - `emptyBucket(storage: StorageLike, bucket: string): Promise<number>`: 하위 폴더까지 `list`로 재귀 순회하면서 100개 단위로 `remove`하고, 지운 개수를 돌려준다.
  - `type StorageLike = Pick<SupabaseClient['storage'], 'from'>`

- [ ] **Step 1: 실패하는 테스트** (sharp로 입력 이미지를 생성한다)

```ts
it('긴 변 1600으로 축소, webp, EXIF 제거', async () => {
  const src = await sharp({ create: { width: 4000, height: 2000, channels: 3, background: '#888' } }).jpeg().withMetadata({ exif: { IFD0: { Copyright: 'secret' } } }).toBuffer();
  const out = await optimizeImage(src);
  const meta = await sharp(out).metadata();
  expect([meta.format, meta.width, meta.height, meta.exif]).toEqual(['webp', 1600, 800, undefined]);
});
it('작은 이미지는 확대하지 않음', async () => { /* 800x600 → 800x600 */ });
it('resolveLocalFile: 없는 파일은 null', ...);
it('emptyBucket: 중첩 폴더를 순회해 모든 파일 remove', async () => { /* storage mock: list('')→[{name:'1',id:null}], list('1')→[{name:'a.webp',id:'x'}] → remove(['1/a.webp']) , 반환 1 */ });
it('uploadImage: error 응답이면 throw', ...);
```

- [ ] **Step 2: 실패 확인** — `npx vitest run scripts/import-confluence/images.test.ts` → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(import): add image optimize and storage helpers"`

---

### Task 9: DB 적재(load)

**Files:**
- Create: `scripts/import-confluence/load.ts`, `scripts/import-confluence/load.test.ts`

**Interfaces:**
- Consumes: Task 1 스키마, `Normalized`.
- Produces:
  - `type UploadedPaths = { activityPhotos: Map<string /*sourceKey*/, { position: number; storagePath: string }[]>; documentImageUrls: Map<string /*slug*/, Map<string /*fileName*/, string /*publicUrl*/>> }`
  - `resetDatabase(db: Db): Promise<void>`: 한 트랜잭션에서 `activity_photos, activities, season_members, seasons, documents, board_games, posts, users`를 이 순서로 delete한다.
  - `loadAll(db: Db, n: Normalized, uploaded: UploadedPaths): Promise<Record<string, number>>`: 한 트랜잭션에서 실행하고, 테이블별 upsert 건수를 돌려준다.
    - `users`: `insert(...).onConflictDoUpdate({ target: users.username, set: { displayName, department, updatedAt } })`. **set에 `pinHash`를 넣지 않는다.**
    - username → id 맵은 upsert `returning`으로 만든다.
    - `seasons`(id), `seasonMembers`(PK), `boardGames`(sourceKey, ownerId는 맵으로 찾음), `activities`(sourceKey → returning id), `activityPhotos`(activityId+position), `documents`(slug)도 각 키로 `onConflictDoUpdate`한다.
    - `documents.bodyMd`는 저장하기 전에 `{{img:<file>}}`을 `documentImageUrls`의 URL로 치환한다. 치환할 URL이 없으면 throw한다.
  - `type Db = PostgresJsDatabase<typeof schema>`

- [ ] **Step 1: 실패하는 테스트** (tx mock이 테이블별 `values`와 `onConflictDoUpdate` 인자를 기록하도록 만든다)

```ts
it('users upsert의 set에 pinHash가 없다 (가입자 PIN 보존)', async () => {
  await loadAll(db, normalizedFixture, uploadedFixture);
  const usersCall = calls.find(c => c.table === users)!;
  expect(Object.keys(usersCall.onConflict.set)).not.toContain('pinHash');
  expect(usersCall.onConflict.target).toBe(users.username);
});
it('board_games.ownerId는 username→id 맵으로, Unknown 보유자는 null', ...);
it('documents bodyMd placeholder를 public URL로 치환, 누락 시 throw', ...);
it('모든 쓰기는 하나의 transaction 안에서 수행', ...);
```

- [ ] **Step 2: 실패 확인** — `npx vitest run scripts/import-confluence/load.test.ts` → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(import): load normalized data with idempotent upserts"`

---

### Task 10: CLI 진입점 + 실제 데이터 dry-run

**Files:**
- Create: `scripts/import-confluence/index.ts`, `scripts/import-confluence/cli.test.ts`

**Interfaces:**
- Consumes: `normalize`, `images.*`, `loadAll`, `resetDatabase`.
- Produces:
  - `parseArgs(argv: string[]): { dryRun: boolean; reset: boolean; yes: boolean }`
    - `--reset`이 있는데 `--yes`가 없으면 `Error('--reset requires --yes')`를 던진다.
  - `main()`의 흐름은 다음과 같다.
    1. `data/confluence/pages.json`을 읽는다.
    2. `normalize`를 실행하고 `data/confluence/normalized.json`에 쓴다.
    3. 사진 파일을 `resolveLocalFile`로 확인하고, 없는 파일은 `report.missingFiles`에 기록한 뒤 해당 사진을 제외한다.
    4. `--dry-run`이면 리포트를 출력하고 끝낸다.
    5. 대상 DB 호스트를 출력한다(`new URL(DATABASE_URL).host`).
    6. `--reset`이면 `resetDatabase`를 실행하고, 버킷 5개에 `emptyBucket`을 실행한다.
    7. 이미지를 최적화하고 업로드한다. 동시 실행 수는 4다.
    8. `loadAll`을 실행한다.
    9. 리포트를 출력한다.
  - 리포트 출력 형식: `pages / people / seasons / seasonMembers / boardGames / activities / photos / documents` 건수, `uploaded N files (X MB)`, 그리고 report 배열 4개.

- [ ] **Step 1: 실패하는 테스트** — `parseArgs` 3개 케이스: `[]`, `['--dry-run']`, `['--reset']`이면 throw, `['--reset','--yes']`.
- [ ] **Step 2: 실패 확인** — `npx vitest run scripts/import-confluence/cli.test.ts` → FAIL
- [ ] **Step 3: 구현**(`main`은 `import.meta.url`로 직접 실행될 때만 호출되게 해서 테스트 import 시 실행되지 않게 한다)
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: 실제 데이터 dry-run** — `npm run import:confluence -- --dry-run`
  - 기대값: `activities 91`, `seasons 5`, `documents 2`, `photos 197`(활동 사진만; 회칙 1장과 보관함 3장은 documents에 들어감), `missingFiles []`.
  - `people`, `seasonMembers`, `boardGames` 건수와 report의 Unknown, 매칭 실패, 중복 목록은 출력값을 그대로 기록하고 사용자에게 보여준다(값은 실행 결과로 확정).
  - 출력이 기대와 다르면 원인 파서의 테스트에 해당 케이스를 추가하고 고친 뒤 다시 실행한다.
- [ ] **Step 6: Commit** — `git commit -m "feat(import): add CLI with dry-run report"`

---

### Task 11: 마이그레이션 적용, 실제 import, 검증

**Files:** 없음 (운영 작업과 검증. 결과는 계획 하단 "실행 기록"에 남긴다)

- [ ] **Step 1: 사전 조건** — 사용자가 `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY`를 추가했는지 확인한다. 값은 출력하지 않는다(`grep -c '^SUPABASE_SERVICE_ROLE_KEY=' .env.local` → `1`).
- [ ] **Step 2: 마이그레이션 적용** — Supabase MCP `apply_migration`으로 `0001_confluence_import.sql`과 `0002_confluence_storage_rls.sql`을 순서대로 적용한다. 적용 후 `list_tables`에 신규 5개 테이블이 있는지 확인한다.
- [ ] **Step 3: RLS와 Storage 실동작 확인** (AGENTS.md 6). publishable 키 클라이언트로 확인한다.
  - `from('activity_photos').upload('probe.webp', …)`가 error여야 한다.
  - `from('activities').select()`가 빈 배열이거나 error여야 한다.
  - `from('document_images').getPublicUrl` 요청은 이미지 업로드 후 200이어야 한다.
- [ ] **Step 4: import 실행** — `npm run import:confluence -- --reset --yes`. 출력된 호스트가 이 프로젝트 ref(`kccvdwtznqhqwvoxpvsp`)인지 확인하고, 건수가 Task 10 dry-run과 같은지 본다.
- [ ] **Step 5: 멱등성 확인** — `npm run import:confluence`(reset 없이)를 다시 실행한다. MCP `execute_sql`로 각 테이블 `count(*)`를 조회해서 Step 4와 같은지 확인한다.
- [ ] **Step 6: signed URL 확인** — service role로 `createSignedUrl(<임의 활동 사진 경로>, 60)`을 만들고, 그 URL을 fetch했을 때 200과 `image/webp`가 와야 한다. 같은 경로의 public URL은 400/404여야 한다.
- [ ] **Step 7: claim 확인** — 사전 등록된 임의 사용자 ID로 dev 서버에서 가입하면 같은 `users.id`로 로그인되어야 한다. 확인 후 해당 행의 `pin_hash`를 `NULL`로 되돌린다.
- [ ] **Step 8: 최종 확인과 커밋** — `npx tsc --noEmit`, `npm test`, `npm run build`가 모두 통과해야 한다. 실행 기록을 이 파일 하단에 추가하고 커밋한다(`git commit -m "chore(import): record Confluence import run"`).

---

## 실행 기록

(Task 10 Step 5, Task 11 결과를 여기에 기록)

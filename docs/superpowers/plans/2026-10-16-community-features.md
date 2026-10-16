# 커뮤니티 기능 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 활동 기록 "전체" 기본값, 닉네임·시즌 배지·프로필 팝업, 게시글 사진 여러 장(수정 포함), 게시글·활동·댓글 좋아요와 댓글을 추가한다.

**Architecture:** Drizzle(직접 Postgres 연결) + Server Actions. 새 테이블 5개와 `users.nickname`은 손으로 쓴 마이그레이션 `0005`로 추가한다. 게시글 사진은 서버가 서명 업로드 URL을 발급하고 브라우저가 Storage에 직접 올린 뒤, 저장 시 서버가 경로 소유·존재를 검증한다. 서비스 키는 `src/lib/storage-admin.ts`에서만 쓴다.

**Tech Stack:** Next.js 16.2.10 (App Router, Turbopack), React 19 (`useActionState`, `useOptimistic`), Drizzle ORM 0.45, Supabase Storage(supabase-js 2.110), Vitest + Testing Library, Playwright(헤드리스, 실제 DB·Storage).

**Spec:** `docs/superpowers/specs/2026-10-16-community-features-design.md`

## Global Constraints

- 닉네임: 앞뒤 공백 제거 후 2~20자, 대소문자 무시 중복 불가(DB `lower(nickname)` 고유 인덱스가 최종 보장, 23505 → `이미 사용 중인 닉네임입니다.`).
- 시즌 배지: `[N시즌]`(season_members 참여 수), 최신 시즌(id 최대) 회장은 `[회장]`, 참여 0이면 없음.
- 게시글 사진: 최대 10장, 장당 10MB(10 * 1024 * 1024), `image/*`만. 오류 문구: `사진은 최대 10장까지 올릴 수 있습니다.` / `사진은 한 장에 10MB 이하여야 합니다.` / `이미지 파일만 올릴 수 있습니다.`
- 댓글: 공백 제거 후 1~1000자, 본인 수정·삭제, 관리자(`getAdminUser`) 삭제만. 대댓글 없음.
- 공통 오류: `로그인이 필요합니다.` / `수정 권한이 없습니다.` / `삭제 권한이 없습니다.` / `찾을 수 없습니다.`
- 모든 액션은 세션을 서버에서 다시 확인하고, id는 uuid 형식을 먼저 검사한다.
- `useActionState`용 액션은 `(prevState, formData)` 시그니처.
- 서비스 키 사용은 `src/lib/storage-admin.ts`(server-only)로 한정.
- 공유 운영 DB에 마이그레이션 적용 전 사용자 확인 필수.
- 각 단계 끝: `npx vitest run`, `npm run build`, 전체 E2E(`npm run build && npx next start -p 3100` + `E2E_BASE_URL=http://localhost:3100 npx playwright test`).

## Review Focus

1. 다른 회원 폴더 경로·업로드하지 않은 경로를 `imagePaths`에 끼워 넣음 → 저장 거부 (Task 4.2 단위 테스트).
2. 수정 시 남의 게시글 사진 id를 `removeImageIds`에 넣음 → 해당 게시글 소속이 아니면 무시 (Task 4.2).
3. 같은 닉네임을 대소문자만 바꿔 설정 → 거부, 본인 닉네임을 그대로 다시 저장 → 허용 (Task 3.2).
4. 좋아요 연타·동시 요청 → PK 충돌 없이 최종 상태가 1개 (Task 5.1, `onConflictDoNothing`).
5. 삭제된 대상(게시글·댓글)에 좋아요/댓글 → `찾을 수 없습니다.` (Task 5.1·5.2).

---

## 단계 1: 활동 기록 "전체" 기본값

### Task 1.1: SeasonSelect `allLabel` + 활동 목록 전체 보기

**Files:**
- Modify: `src/components/SeasonSelect.tsx`, `src/components/SeasonSelect.test.tsx`
- Modify: `src/app/activities/page.tsx`, `src/app/activities/page.test.tsx`
- Modify: `tests/archive.spec.ts`

**Interfaces:**
- Produces: `SeasonSelect({ basePath, seasons, selectedId: number | null, allLabel?: string })`. `allLabel`이 있으면 첫 옵션 `{value:"", text: allLabel}`; `""` 선택 시 `router.push(basePath)`.

- [ ] 테스트: `allLabel="전체"`면 옵션이 `['전체', '시즌 2 · …', '시즌 1 · …']`, `selectedId=null`이면 값 `''`, `''` 고르면 `push('/activities')`.
- [ ] 테스트(페이지): season 미지정·잘못된 값 → 제목 `전체 시즌`, `activities.findMany`가 where 없이 호출, 각 줄에 시즌 이름 표시(`with.season`), 요약 `활동 N건`. `?season=1` → 기존과 같음. 활동 0건 + 전체 → `기록된 활동이 없습니다.`
- [ ] 구현: 페이지는 `seasonParam`이 유효한 시즌 id일 때만 그 시즌, 아니면 전체(`resolveSeason`은 명부용으로 유지).
- [ ] E2E(archive.spec): `/activities` 기본이 `전체 시즌`이고 셀렉트 값 `''`, 시즌 선택 → `?season=` → `전체` 선택 → `/activities`.
- [ ] vitest/빌드 통과.

## 단계 2: 마이그레이션

### Task 2.1: `0005_community_features.sql` + Drizzle 스키마

**Files:**
- Create: `supabase/migrations/0005_community_features.sql`
- Modify: `drizzle/schema.ts`, `drizzle/schema.test.ts`, `tests/helpers.ts`

**Interfaces (Drizzle export 이름):** `users.nickname`, `postImages`(id, postId, storagePath, position), `comments`(id, postId, activityId, authorId, content, createdAt, updatedAt), `postLikes`, `activityLikes`, `commentLikes`(각 대상 id + userId + createdAt, 복합 PK). relations: `posts.images`, `posts.comments`, `posts.likes`, `activities.comments`, `activities.likes`, `comments.author`, `comments.likes`.

- [ ] SQL은 스펙 §3.1~3.4 그대로 + `posts.image_url` → `post_images` 이관(`substring(image_url from '/post_images/(.*)$')`, position 0) + 새 테이블 RLS enable + `DROP POLICY IF EXISTS "Allow anonymous inserts avatars|post_images|boardgame_thumbnails" ON storage.objects`.
- [ ] schema.test.ts에 새 테이블·컬럼 존재 테스트.
- [ ] `tests/helpers.ts` createTestUser가 `nickname: username` 저장.
- [ ] **사용자 확인 후** 적용(Supabase MCP `apply_migration` 또는 연결 불가 시 `postgres` 스크립트), 적용 직전 아이디 길이·대소문자 중복 재조회, 적용 후 테이블·정책을 SQL로 확인.
- [ ] publishable 키로 `post_images` 업로드 시도가 거부되는지 스크립트로 확인.

## 단계 3: 닉네임·배지·프로필 팝업

### Task 3.1: 닉네임 검증 + 배지 계산

**Files:** Create `src/lib/nickname.ts`(+test), `src/lib/member-badges.ts`(+test)

**Interfaces:**
- `validateNickname(raw: string): { ok: true; nickname: string } | { ok: false; error: string }` — 오류 `닉네임은 2~20자로 입력해주세요.`
- `NICKNAME_TAKEN = '이미 사용 중인 닉네임입니다.'`, `isUniqueViolation(e: unknown): boolean`(code `23505`, cause 포함).
- `type MemberBadge = { kind: 'president' } | { kind: 'seasons'; count: number }`
- `getMemberBadges(userIds: string[]): Promise<Map<string, MemberBadge>>` — 빈 배열이면 쿼리 없음. `badgeLabel(b: MemberBadge): string` → `회장` / `N시즌`.

- [ ] 테스트: 공백 제거, 1자·21자 거부, 2·20자 허용; 배지: 최신 시즌 회장 → president, 이전 시즌 회장만 → seasons, 기록 없음 → Map에 없음.

### Task 3.2: 마이페이지 닉네임 + 관리자 생성 + 프로필 액션

**Files:** Modify `src/app/actions/mypage.ts`(+test), `src/app/mypage/MypageForm.tsx`(+test), `src/app/mypage/page.tsx`, `src/app/actions/admin.ts`(+test), `src/app/admin/members/page.tsx`(+test). Create `src/app/actions/profile.ts`(+test).

**Interfaces:**
- `getProfile(userId: string): Promise<ProfileView | null>`; `ProfileView = { nickname; profileImageUrl: string|null; bio: string|null; badge: MemberBadge|null; seasonRole: string|null; displayName?: string|null; department?: string }` — 비회원이면 `displayName`/`department` 키 자체가 없음.
- `updateProfile`이 `nickname` 필드를 검증·저장, 23505 → `NICKNAME_TAKEN`.
- `createMember`: 아이디 20자 초과 → `아이디는 20자 이하여야 합니다.`, 다른 회원 닉네임과 겹치면(대소문자 무시) `이미 사용 중인 닉네임과 같은 아이디입니다.`, insert에 `nickname: username`.
- 마이페이지: `닉네임` 입력(required), `로그인 아이디` 읽기 전용. 관리자 표에 `닉네임` 열.

### Task 3.3: UserName·ProfilePopup + 피드·명부 반영

**Files:** Create `src/components/UserName.tsx`(+test), `src/components/ProfilePopup.tsx`(+test). Modify `src/app/page.tsx`, `src/app/members/page.tsx`(+test).

**Interfaces:** `UserName({ userId, nickname, badge: MemberBadge | null })` — 버튼 텍스트 닉네임, 배지 `[회장]`/`[N시즌]`; 클릭 시 `ProfilePopup({ userId, onClose })`가 `getProfile` 호출 후 role=dialog(aria-label `${nickname} 프로필`), 닫기/ESC/배경.
- 피드: 작성자 아이디·부서 제거 → `UserName`. 명부: 아이디 줄 → 닉네임.
- [ ] E2E(mypage.spec/posts.spec): 닉네임 변경 → 피드 반영, 중복 거부, 피드에 아이디 없음, 팝업 회원/비회원 차이.

## 단계 4: 게시글 사진 여러 장

### Task 4.1: storage-admin 확장 + 프로필 사진 서비스 키 업로드

**Files:** Modify `src/lib/storage-admin.ts`(+test), `src/app/actions/mypage.ts`, `next.config.ts`

**Interfaces:**
- `createPostImageUploadUrls(paths: string[]): Promise<{ path: string; token: string }[]>` (throw on error)
- `existingPostImagePaths(userId: string, paths: string[]): Promise<Set<string>>` — `list(userId)` 기반.
- `removePostImages(paths: string[]): Promise<void>` — 실패 시 console.error만.
- `uploadAvatar(path: string, body: Buffer, contentType: string): Promise<void>` (throw on error)
- `postImagePublicUrl(path: string): string` — 서버 전용이 아닌 공개 URL 계산은 `src/lib/post-images.ts`의 순수 함수로 둔다(`${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post_images/${path}`).
- `next.config.ts`: `experimental.serverActions.bodySizeLimit: '11mb'`(문서 확인 후).

### Task 4.2: 게시글 액션

**Files:** Modify `src/app/actions/post.ts`, `src/app/actions/post.test.ts`; Create `src/lib/post-images.ts`(+test)

**Interfaces:**
- `post-images.ts`: `MAX_POST_IMAGES = 10`, `MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024`, `checkImageFiles(files: {type: string; size: number}[], existing = 0): string | null`(오류 문구 또는 null), `extensionFor(type: string): string`, `postImagePublicUrl(path)`.
- `requestPostImageUploads(files: {type: string; size: number}[], existingCount?: number): Promise<{ uploads: {path; token}[] } | { error: string }>`
- `createPost(prev, formData{content, imagePaths*})`, `updatePost(prev, formData{id, content, imagePaths*, removeImageIds*})`, `deletePost(id)` — 사진 행·파일 정리.
- [ ] 테스트: 남의 폴더 경로 거부, 존재하지 않는 경로 거부, 11장 거부, 수정 시 다른 글의 이미지 id 무시, 삭제 시 `removePostImages` 호출.

### Task 4.3: 폼·피드·라이트박스

**Files:** Create `src/components/PostImagePicker.tsx`(+test), `src/components/PostForm.tsx`(작성·수정 공용 클라이언트 폼, +test). Modify `src/components/ImageLightbox.tsx`(+test), `src/app/posts/write/page.tsx`, `src/app/posts/[id]/edit/*`, `src/app/page.tsx`.

**Interfaces:**
- `ImageLightbox({ images: {src: string; alt: string}[] })` — 썸네일 줄, 클릭 시 그 인덱스로 열림, 이전/다음 버튼·←/→, `n / N`.
- `PostForm({ mode: 'create' | 'edit', post?: { id; content; images: {id; url}[] } })` — 제출 시 `requestPostImageUploads` → `createClient().storage.from('post_images').uploadToSignedUrl` → FormData에 `imagePaths` 추가 → 액션 호출(`useActionState` 디스패치를 `startTransition`으로).
- [ ] E2E(posts.spec): 3장 작성·로드 확인 → 수정에서 1장 삭제·1장 추가 → 지운 파일이 Storage에서 사라짐 → 글 삭제 시 나머지 삭제; 11장 거부; 10MB 초과 거부.

## 단계 5: 좋아요·댓글

### Task 5.1: reactions 액션 + LikeButton

**Files:** Create `src/app/actions/reactions.ts`(+test), `src/components/LikeButton.tsx`(+test)

**Interfaces:**
- `type LikeTarget = 'post' | 'activity' | 'comment'`
- `toggleLike(target: LikeTarget, id: string): Promise<{ liked: boolean; count: number } | { error: string }>` (스펙의 3개 액션을 하나로 묶고 target으로 테이블 선택).
- `LikeButton({ target, id, liked, count, canLike })` — `useOptimistic`, 실패 시 되돌림·오류 표시; 비회원은 aria-disabled, 클릭 시 `로그인하면 좋아요를 누를 수 있습니다.`

### Task 5.2: comments 액션 + CommentSection

**Files:** Create `src/app/actions/comments.ts`(+test), `src/components/CommentSection.tsx`(+test), `src/lib/comments.ts`(조회 헬퍼)

**Interfaces:**
- `addComment(prev, formData{target: 'post'|'activity', targetId, content})`, `updateComment(prev, formData{id, content})`, `deleteComment(id: string): Promise<{ error?: string }>`.
- `loadComments(target, ids: string[], viewerId: string | null): Promise<Map<string, CommentView[]>>`; `CommentView = { id, authorId, nickname, badge, content, createdAt, edited, likeCount, liked }`.
- `CommentSection({ target, targetId, comments, viewer: { id; isAdmin } | null })`.

### Task 5.3: 피드·활동 화면 연결

**Files:** Modify `src/app/page.tsx`, `src/app/activities/page.tsx`, `src/app/activities/[id]/page.tsx` (+tests); Create `src/components/PostReactions.tsx`(❤/💬 토글 클라이언트).
- 활동 목록 줄: `📷 N ❤ N 💬 N`(0 생략).
- [ ] E2E(새 `tests/community.spec.ts`): 좋아요 토글·새로고침 유지(게시글·활동·댓글), 댓글 작성·수정·삭제, 타 회원 차단, 관리자 삭제, 비회원 조회만.

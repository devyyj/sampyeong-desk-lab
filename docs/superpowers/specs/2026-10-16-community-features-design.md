# 커뮤니티 기능 확장 설계 (2026-10-16)

- 상태: 구현 완료(2026-10-16). 마이그레이션 0005 운영 DB 적용됨(사용자 결정: 한 번에 적용)
- 대체: 같은 날 작성했던 `2026-10-16-activity-likes-comments-design.md`(활동 기록만 대상)를 이 문서로 대체한다.
- 선행: `2026-10-16-archive-views-design.md`, `2026-10-16-admin-managed-accounts-design.md`

## 1. 목적과 성공 기준

회원들이 서로를 닉네임으로 알아보고, 게시글과 활동 기록에 반응(좋아요)과 대화(댓글)를 남기는 커뮤니티로 만든다. 아이디(사내 ACE ID)는 로그인 수단으로만 쓰고 화면에는 드러내지 않는다.

성공 기준:
1. 활동 기록은 처음 열면 모든 시즌의 활동이 보인다.
2. 회원은 마이페이지에서 닉네임을 바꿀 수 있고, 게시글·댓글에는 닉네임과 시즌 배지만 보인다. 닉네임을 누르면 프로필 팝업이 뜬다.
3. 게시글에 사진을 최대 10장(장당 10MB) 올릴 수 있고, 수정할 때 사진을 빼거나 더할 수 있다.
4. 게시글·활동 기록·댓글에 좋아요를 누를 수 있고, 게시글·활동 기록에 댓글을 쓸 수 있다.
5. 익명(publishable 키) Storage 업로드 경로가 닫힌다.

## 2. 결정 사항 (대화에서 확인)

| 항목 | 결정 |
|---|---|
| 활동 기록 기본 보기 | 셀렉트 맨 위 "전체"가 기본(`/activities`). 회원 명부는 지금처럼 최신 시즌 기본 |
| 닉네임 | 2~20자, 대소문자 무시 중복 불가, 앞뒤 공백 제거. 최초값 = 아이디(기존 회원은 마이그레이션, 새 회원은 생성 시). 마이페이지에서 언제든 변경 |
| 닉네임 표시 범위 | 게시글 작성자, 댓글 작성자(게시글·활동). 회원 명부와 보드게임 보유자는 실명 유지 |
| 시즌 배지 | 닉네임 옆 `[N시즌]` = `season_members` 참여 시즌 수. 최신 시즌의 회장은 숫자 대신 `[회장]`. 참여 기록이 없으면 배지 없음 |
| 프로필 팝업 | 회원에게: 사진·닉네임·실명·부서·자기소개·배지(참여 시즌 수, 최신 시즌 직책). 비회원에게: 사진·닉네임·자기소개·배지(실명·부서 제외) |
| 게시글 사진 | 최대 10장, 장당 10MB, 이미지 MIME만. 수정 시 개별 삭제·추가 |
| 업로드 방식 | 브라우저가 서명된 업로드 URL로 Storage에 직접 업로드(아래 §5) |
| 좋아요·댓글 | 게시글·활동 기록에 좋아요와 댓글, 댓글에 좋아요. 회원만 작성, 비회원은 조회만 |
| 댓글 관리 | 본인 수정·삭제, 관리자 삭제(수정 불가). 대댓글 없음 |
| 피드 작성자 표시 | 닉네임+배지만. 지금 표시하는 부서는 빼고 팝업에서 확인 |
| 회원 명부 | 실명 아래 표시하던 아이디를 닉네임으로 교체 |
| 관리자 회원 관리 | 관리용이므로 아이디 유지, 닉네임 열 추가 |

## 3. 데이터 모델

마이그레이션 `supabase/migrations/0005_community_features.sql`(손으로 작성) + `drizzle/schema.ts` 반영. 공유 Supabase DB(실서비스와 같음)에 적용되므로 **적용 직전에 사용자 확인**을 받고 `apply_migration`으로 반영한 뒤 결과를 SQL로 확인한다.

### 3.1 닉네임
```sql
ALTER TABLE users ADD COLUMN nickname varchar(20);
UPDATE users SET nickname = left(username, 20);
ALTER TABLE users ALTER COLUMN nickname SET NOT NULL;
CREATE UNIQUE INDEX users_nickname_lower_unique ON users (lower(nickname));
```
- 아이디가 20자를 넘거나 대소문자만 다른 아이디가 있으면 위 SQL이 실패한다. 2026-10-16 조회 결과 회원 53명 중 해당 행은 없다(가장 긴 아이디 14자, 대소문자 중복 0건). 적용 직전에 같은 조회를 한 번 더 한다.
- 아이디 길이 제한(50자)이 닉네임(20자)보다 길므로, `createMember`는 20자를 넘는 아이디를 거부한다(사내 ACE ID는 이 범위 안).
- 중복 판정은 DB 고유 인덱스가 최종 보장한다(동시에 같은 닉네임으로 바꾸는 경쟁 상황 포함). 액션은 고유 위반(23505)을 "이미 사용 중인 닉네임입니다."로 바꿔 돌려준다.

### 3.2 게시글 사진
```
post_images
  id            uuid PK DEFAULT gen_random_uuid()
  post_id       uuid NOT NULL FK posts.id ON DELETE CASCADE
  storage_path  text NOT NULL            -- post_images 버킷 안 경로: {userId}/{uuid}.{ext}
  position      integer NOT NULL         -- 0부터, 표시 순서
  UNIQUE (post_id, position)
```
- 기존 `posts.image_url`(공개 URL)은 경로를 잘라 `post_images`에 position 0으로 옮긴다. 컬럼은 이번에 지우지 않고 코드에서만 쓰지 않는다(되돌릴 수 있게). 다음 정리 작업에서 지운다.
- 공개 URL은 저장하지 않고 화면에서 `getPublicUrl(path)`로 만든다(버킷은 지금처럼 public).

### 3.3 좋아요·댓글
```
comments
  id           uuid PK
  post_id      uuid NULL FK posts.id      ON DELETE CASCADE
  activity_id  uuid NULL FK activities.id ON DELETE CASCADE
  author_id    uuid NOT NULL FK users.id  ON DELETE CASCADE
  content      text NOT NULL
  created_at, updated_at timestamp NOT NULL DEFAULT now()
  CHECK (num_nonnulls(post_id, activity_id) = 1)
  INDEX (post_id, created_at), INDEX (activity_id, created_at)

post_likes      (post_id     FK cascade, user_id FK cascade, created_at)  PK (post_id, user_id)
activity_likes  (activity_id FK cascade, user_id FK cascade, created_at)  PK (activity_id, user_id)
comment_likes   (comment_id  FK cascade, user_id FK cascade, created_at)  PK (comment_id, user_id)
```
- 댓글을 한 테이블에 두는 이유: 댓글 좋아요·수정·삭제·권한 로직을 하나로 유지한다. CHECK로 "게시글 또는 활동 중 정확히 하나"를 DB가 보장한다.
- 좋아요를 대상별 테이블로 두는 이유: 진짜 FK와 cascade를 걸 수 있고, PK로 "회원당 1회"가 보장된다.

### 3.4 RLS·Storage 정책
- 새 테이블 5개(`post_images`, `comments`, `post_likes`, `activity_likes`, `comment_likes`)는 `ENABLE ROW LEVEL SECURITY`만 하고 정책은 두지 않는다. 앱은 Drizzle 직접 연결이라 영향이 없고 publishable 키 REST 경로만 막는다(0002·0003과 같은 방침).
- 마이그레이션에 기록되지 않은 채 운영 DB에 있는 정책 `Allow anonymous inserts avatars|post_images|boardgame_thumbnails`를 삭제한다. 이 정책 때문에 브라우저에 공개된 publishable 키만으로 누구나 공개 버킷에 파일을 올릴 수 있다. 삭제 후에는 업로드가 모두 서비스 키(서명 URL 발급 포함)로만 가능하다.
- 마이그레이션 적용 직후 publishable 키로 업로드를 시도해 거부되는지 실제로 확인한다(AGENTS.md 6번).

### 3.5 시즌 배지 계산
새 테이블 없이 `src/lib/member-badges.ts`의 `getMemberBadges(userIds)`가 계산한다.
- `season_members`를 user_id별로 센 값 = 참여 시즌 수.
- 최신 시즌(id 최대)에서 role이 '회장'인 회원은 `{ kind: 'president' }`, 그 외 참여 수가 1 이상이면 `{ kind: 'seasons', count }`, 0이면 null.
- 화면 하나에서 여러 작성자의 배지를 한 번의 쿼리로 가져온다(N+1 방지).

## 4. 화면과 구성 단위

### 4.1 활동 기록 "전체" (`/activities`)
- `SeasonSelect`에 `allLabel` 옵션을 추가한다. 주면 맨 위에 `전체`(value `""`)를 넣고, 고르면 `basePath`로 이동한다. 회원 명부는 이 옵션을 쓰지 않는다.
- `?season=` 값이 없거나 잘못되면 활동 기록은 전체를 보여준다(`resolveSeason`은 명부용으로 그대로 두고, 활동 기록은 "없으면 전체" 규칙을 페이지에서 처리).
- 전체 보기 제목은 `전체 시즌`, 요약은 전체 활동 수·종류별 수. 각 줄에 시즌 이름을 작은 글씨로 표시한다.
- 상세의 "← 시즌 N 활동 목록" 링크는 그대로 해당 시즌으로 간다.

### 4.2 닉네임·배지·프로필 팝업
- `UserName`(클라이언트): props `{ userId, nickname, badge }`. 닉네임 버튼과 배지를 그린다. 누르면 `ProfilePopup`을 연다.
- `ProfilePopup`: 열릴 때 서버 액션 `getProfile(userId)`를 호출해 내용을 가져온다. 이 액션은 세션을 보고 회원이면 실명·부서를 포함하고 비회원이면 뺀다. 이렇게 하면 실명이 페이지 HTML에 미리 실리지 않는다. 닫기는 `ImageLightbox`와 같은 방식(닫기 버튼·ESC·배경 클릭).
- 마이페이지: `닉네임` 입력란(필수)을 추가하고, 아이디는 `로그인 아이디`라는 이름으로 읽기 전용 표시. `updateProfile`이 닉네임 검증·중복 처리를 한다.
- 관리자 `createMember`: `nickname = username`으로 함께 저장. 아이디가 다른 회원의 닉네임과 겹치면 "이미 사용 중인 닉네임과 같은 아이디입니다." 오류.
- 회원 명부 카드: 실명 아래 줄의 아이디를 닉네임으로 바꾼다.
- 관리자 회원 관리 표: 닉네임 열 추가.

### 4.3 게시글 사진 여러 장
- 작성·수정 폼의 파일 입력은 `multiple`. 고르는 즉시 썸네일 미리보기를 보여주고, 개수(기존+새로 ≤ 10)·크기(≤ 10MB)·형식(image/*)을 클라이언트에서 먼저 검사한다. 서버에서도 같은 규칙을 다시 검사한다.
- 제출 흐름(§5)으로 업로드한 뒤 `createPost`/`updatePost`에 `content`, `imagePaths[]`(순서대로), 수정 시 `removeImageIds[]`를 보낸다.
- 수정 화면: 기존 사진마다 삭제 토글(×), 새 사진 추가. 순서는 남은 기존 사진 → 새 사진.
- 피드: 사진을 128px 썸네일로 한 줄(넘치면 줄바꿈) 표시. 누르면 `ImageLightbox`가 그 게시글의 사진 목록을 받아 이전/다음(버튼·←/→ 키)과 `n / N` 표시를 한다.
- 삭제 정리: 수정에서 뺀 사진과 게시글 삭제 시의 사진은 DB 행과 Storage 파일을 함께 지운다. Storage 삭제 실패는 로그만 남기고 사용자 작업은 성공 처리한다(파일이 남는 것보다 글 삭제 실패가 더 나쁘다).

### 4.4 좋아요·댓글
- `LikeButton`(클라이언트): `{ target: 'post'|'activity'|'comment', id, liked, count, canLike }`. 회원이면 `useOptimistic`으로 즉시 반영하고 액션 결과로 확정, 실패하면 되돌리고 오류 표시. 비회원이면 수만 표시하는 비활성 버튼(누르면 로그인 안내).
- `CommentSection`: 댓글 목록(오래된 순) + 작성 폼. 각 댓글은 `UserName`, 시간(수정됐으면 "(수정됨)"), 내용(`whitespace-pre-wrap`, 마크다운 아님), 댓글 `LikeButton`, 본인이면 수정·삭제, 관리자면 삭제.
- 게시판 피드: 각 글 아래 `❤ N`(LikeButton), `💬 N` 버튼. 💬를 누르면 그 자리에서 `CommentSection`이 펼쳐진다. 댓글 데이터는 피드 조회 때 함께 가져오되(동호회 규모라 충분히 작음) 접힌 상태로 렌더링한다.
- 활동 상세: 본문·사진 아래에 LikeButton과 CommentSection을 항상 펼쳐 둔다. 활동 목록에는 각 줄에 `📷 N ❤ N 💬 N`(0이면 생략).
- 작성 폼은 `useActionState(action(prevState, formData))`(AGENTS.md 3번).

## 5. 사진 업로드 흐름 (방식 A)

```
브라우저                              서버 액션                         Supabase Storage
 파일 선택·검사(≤10장, ≤10MB, image/*)
 ── requestPostImageUploads([{type,size}]) ─▶ 로그인·개수·크기·형식 재검사
                                           경로 {userId}/{uuid}.{ext} 생성
                                           createSignedUploadUrl(서비스 키) ─▶
 ◀────────────── [{path, token}] ─────────
 uploadToSignedUrl(path, token, file) ───────────────────────────────────▶ 저장
 ── createPost(prev, formData{content, imagePaths[]}) ─▶
                                           경로가 모두 `${session.userId}/`로 시작하는지,
                                           Storage에 실제로 있는지(list) 확인
                                           posts + post_images 저장(트랜잭션)
```
- 서명 URL 발급과 Storage 확인·삭제는 모두 `src/lib/storage-admin.ts`(server-only, 서비스 키는 이 파일에서만)에 함수로 추가한다.
- 브라우저는 publishable 키 클라이언트(`src/utils/supabase/client.ts`)의 `uploadToSignedUrl`만 쓴다. 서명 토큰이 있어야 하므로 익명 업로드 정책 없이 동작한다.
- 다른 회원의 경로를 끼워 넣거나 올리지 않은 경로를 보내면 저장을 거부한다.
- 업로드 후 저장 전에 이탈하면 고아 파일이 남을 수 있다. 이번 범위에서는 허용하고, 정리 작업은 범위 밖으로 둔다.
- 프로필 사진(`updateProfile`)은 한 장이라 서버 업로드를 유지하되, 익명 정책 삭제에 맞춰 서비스 키 업로드로 바꾸고 `serverActions.bodySizeLimit`을 `11mb`로 올린다(지금은 기본 1MB라 1MB 넘는 프로필 사진이 실패한다). 게시판 업로드는 서버를 거치지 않으므로 이 제한과 무관하다.

## 6. 서버 액션 요약

| 파일 | 액션 | 규칙 |
|---|---|---|
| `actions/profile.ts` | `getProfile(userId)` | 공개 필드 + 회원이면 실명·부서. 없는 회원이면 null |
| `actions/mypage.ts` | `updateProfile` | 닉네임 검증 추가(2~20자, 중복 23505 처리), 프로필 사진 서비스 키 업로드 |
| `actions/admin.ts` | `createMember` | `nickname = username` |
| `actions/post.ts` | `requestPostImageUploads`, `createPost`, `updatePost`, `deletePost` | §5 흐름, 사진 정리 |
| `actions/reactions.ts` | `togglePostLike`, `toggleActivityLike`, `toggleCommentLike` | 로그인 필수, 토글, `{ liked, count }` 반환 |
| `actions/comments.ts` | `addComment`, `updateComment`, `deleteComment` | 1~1000자(공백 제거 후), 본인 수정·삭제, 관리자(`getAdminUser`, DB 확인) 삭제 |

공통: 세션을 매번 서버에서 확인한다(Server Action은 직접 호출될 수 있음). id는 uuid 형식을 먼저 검사한다(잘못된 값을 조회하면 Postgres 캐스팅 오류 500). 성공 시 관련 경로를 `revalidatePath`한다.

## 7. 오류 처리

- 비로그인 쓰기 → `로그인이 필요합니다.` (화면에서는 애초에 폼·버튼을 감춤)
- 권한 없음 → `수정 권한이 없습니다.` / `삭제 권한이 없습니다.`
- 대상이 그 사이 삭제됨 → `찾을 수 없습니다.` 후 화면 새로고침
- 좋아요 연타 → PK 충돌은 `ON CONFLICT DO NOTHING`, 삭제는 0행이어도 성공으로 취급
- 사진 규칙 위반 → `사진은 최대 10장까지 올릴 수 있습니다.` / `사진은 한 장에 10MB 이하여야 합니다.` / `이미지 파일만 올릴 수 있습니다.`
- 업로드 일부 실패 → 글을 저장하지 않고 실패한 파일 이름을 알려 다시 시도하게 함

## 8. 테스트 (TDD)

- **단위(Vitest)**: 닉네임 검증 함수, `getMemberBadges`(회장·참여 수·없음), 각 액션의 권한·검증·토글·경로 검사(남의 폴더 경로 거부), `getProfile`의 회원/비회원 필드 차이, 컴포넌트(`SeasonSelect` 전체 옵션, `UserName`/`ProfilePopup`, `LikeButton` 낙관적 반영·되돌림, `CommentSection` 버튼 노출 규칙, 다중 사진 폼 검사, 라이트박스 이전/다음).
- **E2E(Playwright, 실제 DB·Storage)**: 기존 스위트 갱신 + 다음 시나리오
  - 활동 기록 기본이 전체, 셀렉트로 시즌 이동 후 "전체"로 복귀
  - 닉네임 변경 → 피드·댓글에 반영, 중복 닉네임 거부, 아이디는 화면 어디에도 없음(피드), 프로필 팝업의 회원/비회원 내용 차이
  - 사진 3장 첨부 작성(실제 파일 업로드, 로드 확인) → 수정에서 1장 삭제·1장 추가 → 삭제한 파일이 Storage에서 지워졌는지 → 글 삭제 시 나머지 파일도 삭제
  - 11장·10MB 초과 거부
  - publishable 키로 직접 업로드 시도가 거부되는지(정책 삭제 확인)
  - 게시글·활동·댓글 좋아요 토글과 새로고침 후 유지, 댓글 작성·수정·삭제, 타 회원 권한 차단, 관리자 삭제, 비회원 조회만
- 각 단계 끝: `npx vitest run`, `npm run build`, 전체 E2E 통과 후 다음 단계.

## 9. 구현 단계

1. 활동 기록 "전체" 기본값 (DB 변경 없음)
2. 마이그레이션 적용(사용자 확인 후) — 이후 단계가 모두 의존
3. 닉네임·배지·프로필 팝업, 마이페이지·관리자·명부 반영
4. 게시글 사진 여러 장·수정·삭제 정리, 업로드 서비스 키 전환, 프로필 사진 본문 제한
5. 좋아요·댓글(게시글, 활동, 댓글 좋아요)

## 10. 범위 밖

대댓글, 알림, 댓글 신고, 고아 업로드 파일 자동 정리, `posts.image_url` 컬럼 삭제, 보드게임 썸네일 버킷 정리, 활동 기록 작성 기능.

## 11. 구현 메모 (설계와 달라진 점)

- 좋아요 액션은 `togglePostLike`/`toggleActivityLike`/`toggleCommentLike` 대신 `toggleLike(target, id)` 하나로 구현했다(규칙이 같아 target으로 테이블만 고른다).
- 저장 시 경로 확인은 `list` 대신 `info(path)`로 한다. 존재 여부와 함께 실제 크기·형식을 확인해, 서명 업로드 URL로 규칙을 우회해 올린 파일을 거부·삭제한다.
- SVG는 이미지로 받지 않는다(공개 버킷 주소를 직접 열면 스크립트가 실행될 수 있음). 경로 확장자는 파일 이름이 아닌 MIME으로 정한다.
- 프로필 사진 본문 한도는 `serverActions.bodySizeLimit`와 함께 `proxyClientMaxBodySize`도 `11mb`로 올렸다. middleware(proxy)가 있으면 Next가 본문을 기본 10MB까지만 복제해 두기 때문이다.
- 프로필 팝업의 "최신 시즌 직책"은 회장 배지로 표시한다(직책 데이터가 회장 외에는 없음).
- 비회원의 좋아요 버튼은 `aria-disabled`를 두지 않는다. 누르면 로그인 안내를 띄우는 버튼이라 비활성으로 읽히면 안 된다.
- 댓글 수정 시각은 DB `now()`로 기록하고, `updated_at ≠ created_at`이면 "(수정됨)"으로 표시한다.
- 활동 목록 "전체" 보기의 시즌 이름은 폰 화면에서는 숨긴다(제목이 너무 잘림).

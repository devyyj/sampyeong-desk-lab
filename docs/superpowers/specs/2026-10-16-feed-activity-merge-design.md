# 피드·활동 기록 데이터 통합 설계

- 작성일: 2026-10-16
- 브랜치: `feature/mobile-redesign` 위에서 이어서 진행(또는 `feature/feed-activity-merge`로 분리)
- 선행: 모바일 개편(`2026-10-16-mobile-redesign-design.md`)

## 1. 목적

활동 기록을 별도 메뉴·테이블로 두지 않고 **게시글의 한 종류("활동 기록")**로 합친다.
회원은 피드 하나에서 일반 글과 활동 기록을 함께 보고, 같은 작성 화면(＋)에서 활동 기록을 직접 작성·수정·삭제한다(활동 CRUD 포함).

## 2. 사용자 결정 사항

| 항목 | 결정 |
|---|---|
| 병합 방식 | 데이터까지 통합: `activities` → `posts` |
| 활동 카드 | 게시글과 같은 카드(사진 캐러셀·좋아요·댓글) |
| 활동 사진 공개 범위 | 활동형 게시글 사진은 **회원 전용 유지**(private 버킷 + signed URL). 일반 글 사진은 지금처럼 공개 |
| 기존 91건 작성자 | 회장 계정(`youngyong.jo`, 시즌 1~5 회장) |
| 본문 형식 | 모든 글 일반 텍스트. 기존 Markdown은 이관 시 **읽기 좋은 일반 텍스트로 변환**(②안) |
| 상세·주소 | `/posts/[id]` 상세 신설, `/activities`·`/activities/[id]`는 리디렉트 |
| 권한 | 회원 누구나 작성, 수정·삭제는 작성자 본인 + 관리자 |
| 시즌 | 작성 시 선택, 기본값은 최신 시즌 |
| 사진 | 작성·수정 시 업로드 지원(최대 10장) |

## 3. 데이터 모델

### 3.1 `posts` 컬럼 추가 (마이그레이션 0006, 추가만 하므로 기존 앱에 영향 없음)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `kind` | varchar(20) not null default `'general'` | `general` \| `activity` |
| `title` | text null | 활동 제목(활동형만). 카드 맨 위에 굵게 표시 |
| `activity_type` | varchar(20) null | `ESCAPE_ROOM`·`REGULAR`·`LUNCH`·`EVENING`·`OTHER` |
| `season_id` | integer null → `seasons.id` | 활동이 속한 시즌 |
| `activity_date` | date null | 모임 날짜 |
| `source_key` | text null unique | 이관 멱등성 키(기존 `activities.source_key`) |

- CHECK: `kind = 'activity'`이면 `title`·`activity_type`·`season_id`·`activity_date`가 모두 NOT NULL, `kind = 'general'`이면 모두 NULL.
- 인덱스: `(kind, created_at desc)`(피드 필터용).
- `post_images`는 그대로 쓴다. 사진이 어느 버킷에 있는지는 **게시글 `kind`로 정한다**(`general` → `post_images` 공개, `activity` → `activity_photos` 비공개). 행마다 버킷 컬럼을 두지 않는 이유: 한 글의 사진은 모두 같은 공개 범위여야 하고, 종류는 작성 후 바꾸지 않는다(§5.3).

### 3.2 기존 테이블 정리 (마이그레이션 0007, 검증 완료 후 별도 단계)

`activity_likes`, `activity_photos`, `activities` 테이블과 `comments.activity_id` 컬럼(및 `comments_one_target` CHECK)을 제거한다.
0006·데이터 이관·앱 배포가 끝나고 운영에서 문제가 없음을 확인한 뒤에만 실행한다(되돌릴 여지를 남긴다).

## 4. 데이터 이관 (`scripts/merge-activities`)

### 4.1 원칙

- **id 유지**: `posts.id = activities.id`로 옮긴다. 댓글 이동이 단순해지고, `/activities/[id]` → `/posts/[id]` 리디렉트도 같은 id로 바로 된다.
- **Storage 파일은 옮기지 않는다**: 활동 사진 197장은 `activity_photos` 버킷에 그대로 두고, `post_images` 행만 같은 `storage_path`로 만든다.
- **한 트랜잭션, 멱등**: 모든 쓰기를 한 트랜잭션으로 하고 `ON CONFLICT DO NOTHING`으로 다시 실행해도 결과가 같게 한다.
- **기본은 dry-run**: 실행하면 변환 결과 보고서만 만든다. `--apply`를 줄 때만 쓴다.
- **백업**: `--apply` 직전에 대상 테이블(activities·activity_photos·activity_likes·comments·comment_likes·posts·post_images·post_likes)을 JSON으로 `data/backup/<시각>/`에 내려받는다(`data/`는 gitignore). Supabase 대시보드 백업도 함께 확인한다.

### 4.2 매핑

| 원본 | 대상 |
|---|---|
| `activities` 1행 | `posts`: `id` 동일, `kind='activity'`, `author_id`=회장, `title`, `activity_type=type`, `season_id`, `activity_date=date`, `source_key`, `content`=§4.3 변환 결과, `created_at`=모임 날짜 정오(KST)*, `updated_at`=원본 `created_at` |
| `activity_photos` | `post_images`(`post_id`=활동 id, `storage_path`·`position` 동일) |
| `comments.activity_id` | `UPDATE comments SET post_id = activity_id, activity_id = NULL` |
| `activity_likes` | `post_likes`(`post_id`=활동 id) |
| `comment_likes` | 변경 없음(댓글 id 유지) |

\* 이관 데이터는 모두 같은 시각에 들어가 `created_at`으로는 순서가 무의미하므로, 피드에서 시간순으로 읽히도록 모임 날짜를 쓴다.

회장 계정은 하드코딩하지 않고 "최신 시즌 `season_members.role = '회장'`"으로 찾는다. 없거나 여러 명이면 실행을 멈춘다.

### 4.3 본문 변환(②안: 읽기 좋은 일반 텍스트)

순수 함수 `markdownToPlain(md)`로 변환하고 단위 테스트로 고정한다.

- 목록: 들여쓰기 깊이(공백 4칸 단위)에 따라 글머리표 `•` `◦` `▪` `▫`, 단계마다 공백 3칸 들여쓰기
- `**굵게**`·`*기울임*`·`` `코드` `` 기호 제거, `\*` 같은 이스케이프는 원래 문자로
- 링크 `[글자](주소)` → `글자 (주소)`, 이미지 `![](…)` → 제거
- 연속 빈 줄은 하나로, 앞뒤 공백 정리
- 본문 첫 줄이 제목과 같으면(기호 제거 후 비교) 첫 줄과 그 하위 목록의 들여쓰기를 한 단계 올린다(제목 중복 제거)
- 후기(`note_md`)가 있으면 본문 뒤에 `\n\n─── 후기 ───\n` + 변환한 후기를 붙인다

dry-run 보고서에 91건 전부의 변환 전·후를 남겨, 사람이 훑어보고 `--apply`한다.

### 4.4 Confluence 이관 스크립트

`scripts/import-confluence`는 1회성 이관을 마쳤다. 활동 적재 부분은 0007에서 테이블이 없어지면 동작할 수 없으므로 활동 관련 코드를 제거하고, 회원·문서·보드게임 적재만 남긴다.

## 5. 앱 변경

### 5.1 내비게이션

하단 탭은 **피드 · 보드게임 · 회원 · MY** 4개다. `/activities` → `/?kind=activity`, `/activities/[id]` → `/posts/[id]`로 영구 리디렉트(308)한다(`next.config` redirects).

### 5.2 피드 (`/`)

- 상단 필터 칩: **전체 · 활동 기록 · 자유글**(`?kind=`). 활동 기록은 종류별 칩(방탈출·정기 모임·점심·저녁·기타)을 추가로 고를 수 있다.
- **무한 스크롤**: 활동 91건이 합쳐지면 한 번에 다 그리기 무겁고, 활동 사진은 장마다 signed URL 발급이 필요하므로 한 페이지에 10건씩 서버 액션으로 이어 붙인다(기존 ActivityFeed와 같은 방식).
- **활동 카드**: 작성자 줄 아래에 종류 배지·시즌 칩·모임 날짜(`7월 31일 (금)`) → 굵은 제목 → 사진 캐러셀 → 반응 → 본문(3줄 접기) → 댓글.
  - 회원: 사진을 signed URL로 보여준다(페이지 단위로 한 번에 발급).
  - 비회원: 사진 자리에 "로그인하면 사진 N장을 볼 수 있어요" 안내. HTML에 signed URL이 실리지 않게 한다.
- 일반 카드는 지금과 같다.

### 5.3 작성·수정 (`/posts/write`, `/posts/[id]/edit`)

- 같은 전체 화면 폼(FormHeader)에 **종류 전환(일반 글 | 활동 기록)**을 둔다. 작성할 때만 고를 수 있고, 수정 화면에서는 바꿀 수 없다(사진 버킷이 달라지므로).
- 활동 기록 입력: 제목(필수), 종류(칩 선택, 필수), 모임 날짜(기본 오늘), 시즌(기본 최신), 사진, 본문.
- 사진 업로드: `requestPostImageUploads`가 종류를 받아 버킷을 정한다(활동 → `activity_photos` private, 경로 `${userId}/${uuid}.${ext}`). 서버의 경로·파일 검사도 버킷별로 한다.
- 권한: 수정·삭제는 작성자 본인 또는 관리자(서버 액션이 DB로 다시 확인). 일반 글도 같은 규칙을 적용한다(관리자가 부적절한 글을 정리할 수 있게).
- 삭제하면 사진 파일도 해당 버킷에서 지운다.

### 5.4 상세 (`/posts/[id]`, 신설)

전체 본문(접지 않음), 사진 캐러셀(활동형은 회원만), 좋아요, 댓글 펼침. 피드 카드의 "댓글 N개 모두 보기"는 지금처럼 시트로 열고, 카드 제목·본문을 누르면 상세로 간다.

### 5.5 제거되는 코드

`/activities` 페이지들, `ActivityFeed`, `lib/activity-list`, `actions/activities`, 좋아요·댓글의 `activity` 대상(`reactions`, `community`, `CommentSection`의 target), `activity-types`는 게시글 종류 배지용으로 유지한다.

## 6. 보안·정책 확인

- 활동형 사진은 비회원에게 URL을 발급하지 않는다(서버에서 세션 확인 후 signed URL 발급, AGENTS.md 6번).
- `posts`의 RLS·anon 정책은 변경하지 않는다(앱은 Drizzle 직접 연결). 새 컬럼은 기존 정책을 그대로 따른다.
- `activity_photos` 버킷에는 계속 storage 정책을 두지 않는다. 업로드는 서버가 발급한 서명 업로드 토큰으로만 한다.

## 7. 테스트

- 단위(TDD): `markdownToPlain`(실제 데이터 패턴: 4단계 목록, 굵게, 이스케이프, 이모지, 제목 중복), 이관 매핑 함수, `createPost`/`updatePost`의 종류별 검증과 권한(작성자·관리자·타인), 피드 페이지네이션, 활동 사진 URL 발급(비회원 미발급), 리디렉트 설정.
- 이관 스크립트: dry-run 결과(91건·197장·댓글 1·좋아요 1)를 검증하는 테스트, 두 번 실행해도 같은 결과(멱등).
- E2E(실제 DB·Storage, 헤드리스):
  - 회원이 사진을 첨부해 활동 기록 작성 → 사진이 `activity_photos`에 올라가고 회원에게는 signed URL로 보이며, 비회원에게는 안내만 보임
  - 작성자·관리자 수정·삭제, 타인 불가
  - 이관된 활동이 피드·상세에 댓글·좋아요와 함께 보임
  - `/activities/[id]` → `/posts/[id]` 리디렉트
- 단계마다 `npx tsc --noEmit`, `npm run build`.

## 8. 진행 순서

1. 0006 스키마 마이그레이션(추가만) + 앱 코드(통합 피드·작성·상세·리디렉트) 개발, 테스트
2. 이관 스크립트 dry-run → 보고서 검토(사용자 확인)
3. 백업 → `--apply` → 검증 쿼리(건수·댓글·좋아요·사진)
4. 앱 배포(사용자 진행) 후 운영 확인
5. 확인이 끝나면 0007 정리 마이그레이션과 Confluence 스크립트 정리

운영 DB에 쓰는 3·5단계는 실행 직전에 다시 확인을 받는다.

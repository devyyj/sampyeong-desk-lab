# Confluence → DB 마이그레이션 설계

- 작성일: 2026-10-15
- 상태: 사용자 검토 대기
- 범위: **스키마 변경 + import 스크립트 + 가입 연결(claim)**. 조회 UI(활동 기록, 시즌 명부, 문서 페이지)는 별도 스펙으로 분리한다.

## 1. 배경과 목표

동호회 운영 정보가 사내 Confluence(`삼평동 책상 전략 연구소` 하위 16개 페이지)에 있다. 이 웹앱이 Confluence를 대체하도록, 정형 데이터는 DB 테이블로, 서술형 문서는 Markdown 본문으로 **1회성 이관**한다.

성공 기준:
- 회원 명부(시즌 1~5), 보드 게임 보유 현황, 공용 보관함, 활동 기록(91건, 사진 197장), 회칙·보관함 안내(이미지 4장)가 DB/Storage에 들어간다.
- Confluence 회원은 "사전 등록" 계정으로 들어가고, 본인이 같은 사내 ID로 가입하면 기존 기록이 그대로 연결된다.
- import는 재실행해도 중복이 생기지 않는다(멱등).
- 개인정보(실명·부서·사내 ID·얼굴 사진)는 git에 남지 않고, 활동 사진은 비회원에게 노출되지 않는다.

## 2. 결정 사항 (사용자 확인 완료)

| 항목 | 결정 |
|---|---|
| 회원 처리 | 사내 ID로 사전 등록(PIN 없음) → 가입 시 연결 |
| 가입 연결 본인 확인 | 하지 않음 (사내 동호회, 문제 시 DB에서 초기화) |
| 활동 기록 구조 | 반정형: 날짜·시즌·종류·제목은 컬럼, 나머지는 Markdown |
| 공개 범위 | 활동 사진·회원 명부는 회원 전용, 보드게임·회칙·보관함 안내는 공개 |
| Unknown User(퇴사자 등) | import하지 않음 |
| 기존 DB 데이터(E2E 테스트 데이터) | 최초 import 시 전부 비움 (`--reset`) |
| 회원 목록 페이지 기준 | 현재 시즌 명부 + 미가입 배지 + 시즌 탭 → **UI 스펙에서 구현** |
| 이관 방식 | TypeScript import 스크립트 (파싱 → 이미지 업로드 → DB upsert) |

## 3. 스키마 변경 (`drizzle/schema.ts`)

### 3.1 기존 테이블 변경

**`users`**
- `pin_hash`: `NOT NULL` → **nullable**. `NULL`이면 사전 등록(미가입) 상태.
- `display_name varchar(50)` 추가: 실명(예: `홍길동`). `username`에는 사내 ID(예: `gildong.hong`)가 들어간다.
- `department`는 `NOT NULL` 유지(Confluence 표기 `이름/부서`에서 추출).

**`board_games`**
- `category varchar(50)`: 카테고리(예: `전략`, `추리`).
- `owner_id uuid → users.id (on delete set null)`: 보유자. 기존 `added_by_id`(등록자)와 별개.
- `note text`: 비고(예: `머더 미스터리`).
- `in_shared_cabinet boolean NOT NULL DEFAULT false`: 공용 보관함 보관 여부.
- `source_key text UNIQUE` (nullable): import 멱등성 키. 앱에서 만든 게임은 `NULL`.

### 3.2 신규 테이블

| 테이블 | 컬럼 | 키 |
|---|---|---|
| `seasons` | `id int`(1~5), `name`(`시즌 1`), `period`(`25년 4분기`) | PK `id` |
| `season_members` | `season_id → seasons`, `user_id → users (cascade)`, `role`(`회장` 등, nullable), `note`(🎖️/💎 등 원문, nullable) | PK (`season_id`, `user_id`) |
| `activities` | `id uuid`, `season_id → seasons`, `date date`, `type varchar(20)`, `title`, `body_md`, `note_md`(nullable), `source_key text UNIQUE`, `created_at` | PK `id` |
| `activity_photos` | `id uuid`, `activity_id → activities (cascade)`, `storage_path`, `position int` | UNIQUE (`activity_id`, `position`) |
| `documents` | `slug`(PK: `rules`, `shared-cabinet`), `title`, `body_md`, `source_page_id`, `updated_at` | PK `slug` |

`activities.type` 값: `ESCAPE_ROOM` | `REGULAR` | `LUNCH` | `EVENING` | `OTHER`.

### 3.3 마이그레이션
- `drizzle-kit generate --name confluence_import`로 `0001_confluence_import.sql`을 생성한다(컬럼과 테이블 변경). drizzle journal 기준 번호라서 기존 수동 파일 `0001_storage_rls.sql`과 번호가 겹친다.
- 직접 작성하는 `0002_confluence_storage_rls.sql`:
  - 신규 테이블 5개에 `ENABLE ROW LEVEL SECURITY`를 건다. anon 정책은 두지 않는다. 앱은 Drizzle로 직접 연결하므로 영향이 없고, REST 경로로의 노출만 막는다.
  - `activity_photos` 버킷은 **private**으로 만들고 SELECT/INSERT 정책을 두지 않는다. 업로드는 service role, 조회는 서버에서 발급한 signed URL로만 한다.
  - `document_images` 버킷은 **public**으로 만들고 public SELECT 정책만 둔다.
- AGENTS.md 6번 지침에 따라, 적용 직후 anon 키로 `activity_photos` 조회와 업로드가 **거부되는지** 실제로 확인한다.

## 4. Storage와 이미지 처리

- 업로드 전에 `sharp`로 처리한다.
  - 긴 변을 최대 1600px로 줄인다(작은 이미지는 확대하지 않음).
  - WebP(품질 80)로 변환한다.
  - EXIF를 제거해서 GPS 위치 정보가 남지 않게 한다.
- 경로 규칙:
  - 활동 사진: `activity_photos/<seasonId>/<activitySourceKey>/<position>.webp`
  - 문서 이미지: `document_images/<slug>/<n>.webp`
- `documents.body_md`의 이미지 링크는 `document_images`의 public URL로 바꿔서 저장한다.
- 활동 사진은 DB에 `storage_path`만 저장한다. URL은 UI 단계에서 `createSignedUrls`로 발급한다.

## 5. Import 파이프라인 (`scripts/import-confluence/`)

### 5.1 입력
- `data/confluence/pages.json`: Confluence REST `export_view` HTML 원본. 이미 수집해 둔 파일을 이 위치로 옮긴다.
- `data/confluence/attachments/<pageId>/<파일명>`: 본문 이미지 원본.
- `data/`와 `docs/confluence/`는 **gitignore**한다(개인정보 포함).

### 5.2 구성
```
scripts/import-confluence/
├── index.ts            # CLI 진입점: --dry-run, --reset
├── parse/
│   ├── people.ts       # 사용자 멘션 → { username, displayName, department }
│   ├── members.ts      # 시즌 명부 표 → season_members 레코드
│   ├── boardgames.ts   # 보유 현황 + 보관함 표 → board_games 레코드
│   ├── activities.ts   # 활동 표 → activities + 사진 목록
│   └── documents.ts    # 회칙/보관함 안내 → Markdown
├── images.ts           # sharp 최적화 + Storage 업로드
├── load.ts             # 트랜잭션 upsert
└── __fixtures__/       # 익명화한 HTML 조각 (실명·ID 치환)
```

### 5.3 파싱 규칙
- **사람**:
  - 멘션 `<a class="confluence-userlink" data-username="...">`에서 사내 ID를 뽑는다.
  - 링크 텍스트 `이름/부서`를 첫 `/` 기준으로 나눈다.
  - `Unknown User (...)`는 **제외**하고 리포트에 기록한다.
- **시즌**:
  - 페이지 제목 `시즌 N (YY년 Q분기)`와 `시즌 N 회원 명부`에서 시즌 번호를 매칭한다.
  - `period`는 활동 페이지 제목의 괄호 안 값이다.
- **명부**:
  - 표의 1열은 사람, 2열은 비고다.
  - 비고에 `회장`이 있으면 `role`에 넣고, 나머지 원문은 `note`에 넣는다(헤딩 기호 제거).
- **보드게임**:
  - 보유 현황 표 열은 게임 이름, 카테고리, 플레이 인원(`recommended_players`), 보유자, 비고 순서다.
  - 보관함 표(게임 이름, 소유자)는 정규화한 이름(공백·기호 제거, 소문자)과 소유자가 같은 게임에 `in_shared_cabinet=true`를 표시한다.
  - 매칭에 실패하면 새 게임으로 추가하고 리포트에 기록한다.
  - `source_key`는 `<정규화 이름>:<소유자 username>`이다.
  - 보유자가 Unknown User이면 게임은 이관하되 `owner_id`는 `NULL`로 둔다. 이 경우에도 `source_key`에는 원래 사내 ID를 쓴다.
- **활동**:
  - 각 시즌 페이지 표의 행은 [날짜(`<time datetime>`), 내용, 비고]이고, 맨 앞의 번호 열은 무시한다.
  - `title`: 내용 셀에서 첫 번째 최상위 목록 항목의 텍스트(굵게 표시 제거).
  - `type`: 제목을 키워드로 분류한다. 우선순위는 `방탈출` → `ESCAPE_ROOM`, `정기` → `REGULAR`, `점심` → `LUNCH`, `저녁` → `EVENING`, 그 외 `OTHER`이다.
  - `body_md`: 내용 셀 Markdown. `note_md`: 비고 셀에서 이미지를 뺀 Markdown(비어 있으면 `NULL`).
  - 사진: 내용 셀과 비고 셀의 첨부 이미지를 문서 순서대로 모은다.
  - `source_key`: `<pageId>:<행 번호>`.
- **문서**:
  - `rules`는 회칙 페이지 전체다(목차 매크로 제거).
  - `shared-cabinet`은 보관함 페이지에서 "보관중인 게임 목록" 섹션을 뺀 부분이다. 그 목록은 `board_games`에 들어간다.
  - 루트 페이지("그냥 놀고 싶습니다.")와 목록용 상위 페이지(활동 현황, 회원 명부)는 이관하지 않는다.

### 5.4 실행 흐름
1. `pages.json`을 파싱하고 `data/confluence/normalized.json`을 쓴다(검토용). `--dry-run`이면 여기서 리포트를 출력하고 끝낸다.
2. `--reset`이면 다음을 비운다.
   - DB: `activity_photos`, `activities`, `season_members`, `seasons`, `documents`, `board_games`, `posts`, `users`
   - Storage: `avatars`, `post_images`, `boardgame_thumbnails`, `activity_photos`, `document_images`의 모든 객체
   - 실수를 막기 위해 `--reset`일 때는 대상 DB 호스트를 출력하고 `--yes`가 있어야 진행한다.
3. 이미지를 최적화하고 업로드한다. 같은 경로가 있으면 `upsert: true`로 덮어쓴다.
4. 한 트랜잭션에서 upsert한다.
   - 기준 키는 `users`(username), `seasons`(id), `season_members`(PK), `board_games`(source_key), `activities`(source_key), `activity_photos`(activity_id, position), `documents`(slug)이다.
   - 사전 등록 사용자의 upsert는 `pin_hash`를 **절대 덮어쓰지 않는다**. 이미 가입한 사람의 PIN을 지키기 위해서다.
5. 리포트를 출력한다. 테이블별 건수, 업로드 수와 용량, 제외한 Unknown User, 보관함 매칭 실패 항목이 들어간다.

### 5.5 실행 환경
- `npm run import:confluence -- [--dry-run] [--reset --yes]`로 실행한다(`tsx`).
- 필요한 환경 변수: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
  - Service Role Key는 **이 스크립트에서만** 쓰고, 앱 코드(`src/`)에서는 import하지 않는다. `.env.local`에 사용자가 추가해야 한다.
    - 2026-10-16 갱신: 조회 UI에서 활동 사진 signed URL을 발급하기 위해 `src/lib/storage-admin.ts`(server-only) 한 곳에서만 예외로 사용한다(`2026-10-16-archive-views-design.md`).
- 새 devDependency는 `sharp`, `tsx`, `linkedom`이다.

## 6. 앱 코드 변경 (최소 범위)

- **`signup`**:
  - 같은 `username`이 있으면 다음처럼 분기한다.
    - `pin_hash IS NULL`이면 기존 행을 UPDATE한다(`pin_hash`, 입력한 `department`, `updated_at`). 그다음 세션을 만든다.
    - `pin_hash`가 있으면 기존처럼 `이미 존재하는 아이디입니다.` 오류를 낸다.
  - 동시에 가입하는 경우를 막기 위해 UPDATE 조건에 `pin_hash IS NULL`을 넣고, 영향받은 행이 0개면 같은 오류를 낸다.
- **`login`**: `pin_hash`가 `NULL`이면 `아이디 또는 비밀번호가 올바르지 않습니다.`를 낸다. 계정이 있는지 노출하지 않는다.
- **`/members` 페이지**: 시즌 명부 UI가 나오기 전까지 사전 등록 계정 수십 개가 빈 프로필로 보이지 않도록, 임시로 `pin_hash IS NOT NULL`인 사용자만 표시한다.
- `updateProfile` 등 나머지 코드는 변경하지 않는다.

## 7. 테스트 (TDD)

- **파서 단위 테스트** (`// @vitest-environment node`):
  - 익명화한 실제 HTML 조각 fixture로 `people`, `members`, `boardgames`, `activities`, `documents`를 각각 검증한다.
  - 경계 케이스도 넣는다: Unknown User 제외, `회장` 추출, 모임 종류 분류 우선순위, 사진 순서, 빈 비고 → `NULL`, 보관함 이름 매칭(`한밤의 늑대인간` ↔ `한밤의 늑대 인간`).
- **이미지 처리 단위 테스트**: 실제 이미지(`tests/fixtures/dummy.png`)로 검증한다. 결과가 WebP인지, 긴 변이 1600 이하인지, EXIF가 없는지 확인한다.
- **load 단위 테스트**: DB 모듈을 mock해서 upsert 순서와 키를 확인한다. 특히 `pin_hash` 미포함과 `--reset` 시 `--yes` 없이는 거부되는지를 본다.
- **auth 액션 테스트**(기존 `auth.test.ts`에 추가): claim 성공, 이미 가입한 ID 거부, claim 경합으로 0행이 갱신된 경우, `pin_hash NULL` 로그인 거부.
- **통합 검증**(수동 실행, 결과를 기록):
  - `--dry-run` 리포트 건수를 확인한다. 기대값은 활동 91, 활동 사진 197, 문서 2, 시즌 5이며 보드게임과 명부 인원은 리포트로 확정한다.
  - 실제 import 후에는 DB 건수를 확인하고, 재실행해도 건수가 같은지(멱등) 본다.
  - anon 키로 `activity_photos` 접근이 거부되는지, signed URL로는 열리는지 확인한다.
- 커밋 전에 `npx tsc --noEmit`, `npm run build`, `npm test`를 실행한다(AGENTS.md 8번).

## 8. 범위 밖 (후속 스펙)

- 활동 기록, 시즌 명부(현재 시즌 + 미가입 배지 + 시즌 탭), 회칙과 보관함 문서 조회 UI. 여기서 signed URL 발급과 회원 전용 접근 제어를 함께 구현한다.
- 보드게임 목록 UI에 카테고리, 보유자, 보관함 표시 추가.
- 회원 탈퇴 로직, 관리자 권한.

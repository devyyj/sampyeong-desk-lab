# 관리자 발급 계정 전환 설계

- 작성일: 2026-10-16
- 상태: 사용자 검토 대기
- 범위: 회원가입 제거, 관리자(`youngyong.jo`) 전용 회원 생성·PIN 초기화, 초기 PIN 일괄 부여, 첫 로그인 PIN 변경 강제

## 1. 목표

사내 동호회 계정을 **관리자가 발급**하는 방식으로 바꾼다. 누구나 가입하던 구조를 없애고, 관리자가 등록한 아이디와 PIN으로만 로그인하게 한다.

성공 기준:
- `/signup`과 회원가입 액션·링크가 사라진다.
- Confluence에서 이관한 53명(관리자 포함)이 초기 PIN `1234`로 로그인할 수 있다.
- 초기 PIN으로 로그인하면 PIN을 바꾸기 전까지 다른 페이지를 쓸 수 없다.
- 관리자만 `/admin/members`에서 회원 생성과 PIN 초기화를 할 수 있고, 비관리자는 화면과 액션 모두 접근할 수 없다.

## 2. 결정 사항 (사용자 확인 완료)

| 항목 | 결정 |
|---|---|
| 비밀번호 형식 | 4자리 숫자 PIN 유지 |
| 관리자 | `youngyong.jo`, 초기 PIN `1234` |
| 이관 회원 | 전원 일괄 초기 PIN `1234` |
| 첫 로그인 | 초기 PIN 상태면 PIN 변경 강제 |
| 관리자 기능 | 회원 목록, 회원 생성, PIN 설정·초기화 |
| 로그인 시도 제한 | 이번 범위 밖 |
| 권한 판단 | DB 컬럼 + 세션(JWT) 반영, 관리자 액션은 매번 DB 재확인 (접근 A) |

## 3. 스키마 (`drizzle/schema.ts`, 마이그레이션 `0004`)

`users`에 컬럼 2개를 추가한다.
- `is_admin boolean NOT NULL DEFAULT false`
- `must_change_pin boolean NOT NULL DEFAULT false`: true면 다음 로그인부터 PIN 변경 전까지 다른 페이지 이용 불가

## 4. 초기 데이터: `npm run bootstrap:pins`

`scripts/bootstrap-pins.ts` (1회성, 재실행 안전):
- `pin_hash IS NULL`인 사용자 전원: `pin_hash = bcrypt('1234')`, `must_change_pin = true`.
- `youngyong.jo`: `is_admin = true`. 대상 계정이 없으면 오류로 종료한다.
- 이미 PIN이 있는 사용자는 건드리지 않는다(재실행해도 회원이 바꾼 PIN이 초기화되지 않음).
- 출력: PIN을 부여한 인원 수, 관리자 지정 결과.

해싱은 앱과 같은 `hashPIN`(`src/lib/auth-utils.ts`)을 쓴다. SQL 마이그레이션에서 해시를 만들지 않는 이유는 앱과 같은 bcrypt 설정을 보장하기 위해서다.

## 5. 세션

`SessionPayload`에 `isAdmin: boolean`, `mustChangePin: boolean`을 추가한다.
- 로그인, PIN 변경 시 DB 값을 읽어 세션을 (재)발급한다.
- **세션 값은 화면 분기와 페이지 이동 제어에만 쓴다.** 관리자 권한이 필요한 서버 액션과 페이지는 항상 DB의 `is_admin`을 다시 확인한다(관리자 해제가 기존 세션에 즉시 반영되도록).

## 6. 화면과 동작

### 6.1 회원가입 제거
- 삭제: `src/app/signup/`, `signup` 액션과 테스트, GNB와 로그인 화면의 "회원가입" 링크.
- 사전 등록 계정 연결(claim) 로직도 함께 삭제한다.

### 6.2 로그인 (`login`)
- 기존 검증은 유지한다(PIN 없는 계정 거부, 내부 경로로만 이동).
- 성공 시 세션에 `isAdmin`, `mustChangePin`을 담는다. `mustChangePin`이면 `redirect` 값과 관계없이 `/change-pin`으로 보낸다.

### 6.3 PIN 변경 강제 (`/change-pin`, `changePin(prevState, formData)`)
- 입력: 새 PIN, 새 PIN 확인.
- 검증: 4자리 숫자, 두 값 일치, **현재 PIN과 다를 것**(초기 PIN 재사용 방지).
- 성공: `pin_hash` 갱신, `must_change_pin = false`, 세션 재발급 후 `/`로 이동.
- 마이페이지 `updateProfile`에서 PIN을 바꿔도 `must_change_pin = false`로 바꾸고 세션을 재발급한다.

### 6.4 proxy(middleware) 규칙
- 로그인 필요 경로에 `/admin`, `/change-pin`을 추가한다.
- 세션의 `mustChangePin`이 true면 `/change-pin`과 정적 자원을 뺀 모든 페이지 요청을 `/change-pin`으로 보낸다. 로그아웃은 GNB의 서버 액션이라 영향받지 않는다.
- `mustChangePin`이 false인데 `/change-pin`에 오면 `/`로 보낸다.

### 6.5 관리자 화면 (`/admin/members`)
- 서버 컴포넌트에서 DB로 관리자를 확인하고, 아니면 `notFound()`를 반환한다.
- 회원 목록: 아이디, 이름, 부서, 상태(`초기 PIN` / `정상` / `관리자`).
- **회원 생성** `createMember(prevState, formData)`: 아이디(필수, 중복 불가), 이름(필수), 부서(필수), 초기 PIN(4자리, 기본값 `1234`). `must_change_pin = true`로 만든다.
- **PIN 초기화** `resetMemberPin(prevState, formData)`: 대상 사용자 ID와 새 PIN(4자리, 기본값 `1234`). `must_change_pin = true`로 바꾼다. 관리자 본인도 대상이 될 수 있다.
- 두 액션 모두 시작할 때 DB로 관리자를 확인하고, 아니면 `{ error: '권한이 없습니다.' }`를 반환한다.
- GNB: 세션의 `isAdmin`이 true면 "관리자" 메뉴(`/admin/members`)를 보여준다.

## 7. 테스트 (TDD)

- `login`: 세션에 `isAdmin`, `mustChangePin`이 담긴다. `mustChangePin`이면 `/change-pin`으로 이동한다.
- `changePin`: 형식 오류, 불일치, 현재 PIN과 같은 값 거부. 성공 시 플래그 해제와 세션 재발급.
- `updateProfile`: PIN을 바꾸면 플래그가 해제된다.
- `createMember` / `resetMemberPin`: 비관리자 거부, 중복 아이디, PIN 형식, 성공 시 `must_change_pin = true`.
- `/admin/members` 페이지: 비관리자면 `notFound`.
- middleware: `mustChangePin` 세션의 리다이렉트, `/admin` 비로그인 리다이렉트.
- `bootstrap-pins`: PIN 있는 사용자는 갱신 대상이 아니고, 관리자 계정이 없으면 오류.
- GNB: `isAdmin`일 때만 관리자 메뉴, 회원가입 링크 없음.
- E2E(dev 서버, headless): 관리자 `1234` 로그인 → `/change-pin` 강제 → 변경 → 회원 생성 → 새 회원 로그인 → `/change-pin` 강제. 확인 후 테스트 데이터를 정리한다.
- 커밋 전 `npx tsc --noEmit`(기존 오류 5건 외 신규 0건), `npm test`, `npm run build`.

## 8. 범위 밖

- 로그인 시도 횟수 제한·잠금
- 회원 정보 수정·삭제, 관리자 지정·해제 UI
- `middleware.ts` → `proxy.ts` 이름 변경(Next 16 deprecation)

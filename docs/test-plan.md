# SDL(Sampyeong Desk Lab) 종합 테스트 계획서

본 문서는 삼평 데스크 랩(SDL) 웹 서비스의 품질을 보장하기 위해 프론트엔드/백엔드 로직에 대한 단위 테스트(Unit Test)와 서비스 전체 흐름에 대한 E2E(End-to-End) 테스트 계획을 정의합니다.

## 1. 테스트 목적
- **단위 테스트 (Unit Test)**: 개별 컴포넌트, 유틸리티 함수, 그리고 서버 액션(Server Actions)이 독립적인 환경에서 예상대로 동작하는지 검증합니다.
- **E2E 테스트 (End-to-End Test)**: 사용자가 브라우저를 통해 서비스를 이용하는 실제 흐름(UI 조작부터 DB 연동까지)에서 결함이 없는지 검증합니다.

## 2. 테스트 환경
- **단위 테스트**: Vitest, React Testing Library (`@testing-library/react`), jsdom
- **E2E 테스트**: Playwright (`@playwright/test`)
- **실행 환경**: 로컬 개발 환경 및 CI 환경 (브라우저: Chromium)

## 3. 단위 테스트 (Unit Test) 범위 및 대상

### 3.1. Server Actions (`src/app/actions`)
- **`auth.ts`**: 회원가입(Signup), 로그인(Login), 로그아웃(Logout) 로직 검증.
- **`boardgame.ts`**: 보드게임 추가 및 목록 조회 기능 검증.
- **`mypage.ts`**: 내 정보(bio 등) 수정 기능 검증.
- **`post.ts`**: 자유게시판 게시글 작성 및 조회 로직 검증.

### 3.2. Utils & Lib (`src/lib`)
- **`auth-utils.ts`**: PIN 암호화(bcrypt) 및 검증 로직 확인.
- **`session.ts`**: JWT 기반 세션 생성, 파싱 및 쿠키 관리 기능 검증.

### 3.3. UI Components (`src/components` 및 `src/app`)
- **`GNB.tsx`**: 로그인 상태에 따른 네비게이션 바 메뉴 분기 확인.
- **페이지 컴포넌트 (Form 검증)**: 회원가입, 로그인, 마이페이지, 보드게임 등록 폼의 렌더링 및 입력 상태 처리 검증.

## 4. E2E 테스트 (End-to-End Test) 시나리오

실제 Supabase DB·Storage를 대상으로 실행한다(Mock 없음). 회원가입이 없으므로 테스트 계정은 `tests/helpers.ts`가 DB에 `e2e_` 접두사로 직접 만들고, 각 파일의 `afterAll`에서 계정·게시글·보드게임·업로드 파일(post_images, boardgame_thumbnails, avatars)을 모두 지운다.

| 파일 | 시나리오 |
|---|---|
| `tests/auth.spec.ts` | 비회원 보호 경로 8종 → `/login?redirect=` / 로그인 실패(없는 아이디·틀린 PIN 동일 메시지) / 로그인 후 원래 경로 복귀·로그아웃 / 외부 redirect 차단 / 발급 PIN 사용자의 PIN 변경 강제(1234·현재 PIN·불일치 거부 → 변경 → 새 PIN으로만 로그인) |
| `tests/admin.spec.ts` | 일반 회원에게 관리자 메뉴 없음·`/admin/members` 404 / 회원 생성(공백 제거, 중복 거부, 닉네임 최초값 = 아이디) → 새 회원 1234 로그인 시 PIN 변경 강제 / PIN 초기화 → 예전 PIN 무효 / 관리자 해제 즉시 404(DB 재확인) |
| `tests/posts.spec.ts` | 사진 3장 작성(서명 URL로 Storage 직접 업로드·실제 로드·라이트박스 이전/다음) → 수정(1장 삭제·1장 추가, 뺀 파일 Storage에서 삭제 확인) → 다른 회원·비회원은 수정/삭제 불가 → 작성자 삭제(남은 파일 삭제 확인) / 11장·10MB 초과·이미지 아닌 파일 거부 / 삭제 확인 취소 |
| `tests/boardgames.spec.ts` | 등록(보관 상태 없이 공용 보관함 체크만) → 미분류·공용 보관함·전체 필터 → 이름 검색(띄어쓰기·대소문자 무시, 검색 지우기) → 이름 수정·공용 보관함 넣기/빼기(DB 확인) → 삭제 / 카테고리 필터 / 비회원에게 보유자·버튼 숨김 / 보유자 검색은 회원만(비회원 검색 결과로 보유자 노출 안 됨) |
| `tests/mypage.spec.ts` | 부서·자기소개·프로필 사진(미리보기, 업로드 후 로드) 저장 유지 / 1MB 넘는 프로필 사진 업로드(본문 한도 11MB) / 회원 탈퇴 준비 중 안내 / PIN 변경(불일치 시 버튼 잠금, 1234 거부, 변경 후 재로그인) / 초기 PIN 상태면 PIN 변경 화면 우선 |
| `tests/archive.spec.ts` | 활동 기록(비회원 사진 숨김, 회원 signed URL 로드) / 회원 명부(이름 옆 [회장]·[N시즌]) / 동호회 안내 / 보드게임 보관함 필터 / 모바일 메뉴 / 활동 기록 무한 스크롤(시즌 셀렉트 없음, 끝까지 스크롤하면 DB 전체 수와 일치·중복 없음, 시즌 제목이 최신 시즌부터 한 번씩·시즌별 건수 일치, 상세의 시즌 표시와 목록 복귀) / 명부 시즌 셀렉트 쿼리 유지 / 없는 활동·문서 404 |
| `tests/nickname.spec.ts` | 닉네임 변경 → 피드에 닉네임만(아이디·부서 없음) / 다른 회원 닉네임(대소문자 무시) 거부 / 프로필 팝업: 회원은 실명·부서까지, 비회원은 닉네임·소개만(실명이 HTML에 없음) |
| `tests/community.spec.ts` | 게시글 좋아요 토글·새로고침 유지 / 댓글 작성·수정(수정됨)·댓글 좋아요·삭제(좋아요 cascade) / 타 회원은 남의 댓글 수정·삭제 불가 / 관리자는 삭제만 / 비회원은 보기만(좋아요 누르면 로그인 안내) / 활동 상세 좋아요·댓글, 목록의 ❤·💬 수 |
| `tests/security.spec.ts` | publishable 키로 공개 버킷 업로드 시 RLS 거부 / 새 테이블(댓글·좋아요·게시글 사진)을 REST로 읽어도 행 없음 |

## 5. 실행 절차
- **단위 테스트 실행**: `npm run test` (또는 `vitest`)
- **E2E 테스트 실행**: 서버 실행(`npm run dev`) 후 `npx playwright test`
  - 프로덕션 빌드로 실행: `npm run build && npx next start -p 3100` 후 `E2E_BASE_URL=http://localhost:3100 npx playwright test`

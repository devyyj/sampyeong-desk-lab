# 이관 데이터 조회 메뉴 설계 (2026-10-16)

- 상태: 구현 완료 (사용자 요청으로 스펙 검토 단계 생략 후 바로 착수, 설계는 대화에서 승인)
- 선행: `2026-10-15-confluence-db-migration-design.md` §8 "범위 밖(후속 스펙)" 항목을 구현한다.

## 1. 결정 사항

| 항목 | 결정 |
|---|---|
| 메뉴 구조 | 상단 5개 평면 배치: 자유게시판 · 활동 기록 · 보드게임 · 회원 명부 · 동호회 안내 |
| 시즌 | 독립 메뉴 없이 활동 기록·회원 명부의 `?season=N` 탭. 기본은 최신(id 최대) 시즌 |
| 활동 기록 형태 | 시즌 탭 + 목록 + 상세 페이지 |
| 공개 범위 | 이관 스펙대로. 활동 목록·본문, 보드게임, 회칙·보관함 안내는 공개. 활동 사진과 회원 명부는 회원 전용. 보드게임 보유자 실명도 같은 기준으로 회원에게만 표시 |
| 사진 접근 | `src/lib/storage-admin.ts`(server-only)에서만 Service Role Key 사용, 로그인 확인 후 1시간짜리 signed URL 발급 |
| 함께 포함 | 모바일 햄버거 메뉴, 보드게임 카테고리 표기 통일, 회원 명부 '미접속' 배지 |

## 2. 화면

| 경로 | 접근 | 내용 |
|---|---|---|
| `/activities?season=N` | 공개 | 시즌 탭, 시즌 요약(활동 수·종류별 수), 날짜 내림차순 목록(종류 배지·제목·사진 수) |
| `/activities/[id]` | 공개, 사진만 회원 | 본문·비고 Markdown. 회원이면 사진 그리드, 비회원이면 "로그인하면 사진 N장" + 로그인 링크(redirect 포함). uuid 형식이 아니면 DB 조회 없이 404 |
| `/members?season=N` | 회원(middleware) | 시즌 명부. 회장 → 이름순. 직책·미접속(`must_change_pin`) 배지 |
| `/boardgames` | 공개 | 카테고리(빈 값은 "미분류")·보유자(회원만)·공용 보관함 배지. `?cabinet=1`, `?category=` 필터와 개수 |
| `/about/rules`, `/about/shared-cabinet` | 공개 | 문서 탭 + Markdown. `/about`은 `/about/rules`로 redirect. 다른 slug는 404 |

## 3. 구성 단위

- `src/lib/seasons.ts` `resolveSeason(param, seasons)`: 없거나 잘못된 값이면 최신 시즌. 시즌이 없으면 null.
- `src/lib/activity-types.ts` `getActivityType(type)`: 코드 → 이름·배지 색. 모르는 코드는 기타.
- `src/lib/storage-admin.ts` `createSignedPhotoUrls(paths)`: 입력 순서 유지, 개별 실패는 null.
- `src/components/Markdown.tsx`: react-markdown + remark-gfm. raw HTML 미렌더링(XSS 방지). 스타일은 `globals.css`의 `.markdown`.
- `src/components/SeasonTabs.tsx`: 쿼리 기반 시즌 탭(최근 시즌부터).
- `src/components/GNB.tsx`: 접두사 기반 현재 메뉴 표시, 모바일 패널(계정 링크 포함).
- `src/lib/route-guard.ts`: `PROTECTED_PREFIXES`에 `/members` 추가.

## 4. 데이터

- `supabase/migrations/0004_normalize_board_game_categories.sql`: `카드게임→카드 게임`, `마피아 게임→마피아`, `협력게임→협동`. 원격 DB 적용 완료(Supabase MCP `apply_migration`).
- 회원 목록의 임시 필터(`pin_hash IS NOT NULL`)는 시즌 명부로 대체되어 제거.

## 5. 검증

- 단위/렌더링 테스트: 위 구성 단위와 각 페이지(`*.test.ts(x)`).
- E2E `tests/archive.spec.ts`: 비회원 사진 숨김(HTML에 signed URL 없음), `/members` 로그인 redirect, 회원에게 signed URL 사진이 실제 로드(`naturalWidth > 0`), 문서 탭, 보관함 필터, 모바일 메뉴.
- Storage 권한 실측: anon 키로 `activity_photos` 다운로드·서명 발급·public URL 모두 거부, Service Role signed URL은 200.

## 6. 운영

- 사진 signed URL 키: Vercel에는 Supabase 연동이 만든 `SUPABASE_SECRET_KEY`가 이미 있어 그것을 우선 사용하고, 없으면 `SUPABASE_SERVICE_ROLE_KEY`(로컬 `.env.local`, `scripts/`)를 쓴다. 같은 비밀값을 다른 이름으로 중복 등록하지 않는다.
- 배포 점검 중 발견(2026-10-16): Vercel에 `SESSION_SECRET`이 없어 운영 세션 JWT가 저장소에 공개된 개발용 기본 키로 서명되고 있었다(세션 위조 가능). `src/lib/session.ts`의 `resolveSessionSecret`이 production에서 키가 없거나 32자 미만이면 오류를 내도록 바꿨다. **`SESSION_SECRET`을 Vercel에 먼저 등록한 뒤 이 코드를 배포해야 한다.** 순서가 바뀌면 로그인·세션 확인이 전부 실패한다.

## 7. 범위 밖

- 활동 기록 작성·수정 UI, 보드게임 카테고리·보유자 입력 UI, 사진 라이트박스.

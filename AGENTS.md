<!-- BEGIN:nextjs-agent-rules -->
# 여러분이 아는 Next.js가 아닙니다

이 버전에는 큰 변경 사항이 포함되어 있습니다 — API, 규칙, 파일 구조가 학습 데이터와 다를 수 있습니다. 코드를 작성하기 전에 `node_modules/next/dist/docs/`에 있는 관련 가이드를 읽어보세요. 지원 중단(deprecation) 알림에 주의하세요.
<!-- END:nextjs-agent-rules -->

# 프로젝트 지침

1. **테스트 주도 개발 (TDD)**: 모든 새로운 기능과 버그 수정은 TDD 원칙을 따라야 합니다. 실패하는 테스트를 먼저 작성한 다음, 테스트를 통과하도록 코드를 구현하고 리팩터링하세요.
2. **상세한 주석**: 복잡한 로직, 결정 사항 및 명확하지 않은 구현 세부 사항의 "이유(why)"를 설명하는 상세한 주석으로 코드를 철저하게 문서화해야 합니다.
3. **Server Actions와 useActionState (React 19+)**: 클라이언트 컴포넌트에서 `useActionState`와 함께 Server Action을 사용할 때, Action 함수의 첫 번째 인자는 **반드시 `prevState`**가 되어야 하고, 두 번째 인자로 `FormData`가 전달됩니다 (예: `async function action(prevState: any, formData: FormData)`). `FormData`만 인자로 받는 기존 방식은 런타임에 Null 오류를 발생시킬 수 있으니 주의하세요.
4. **기본 브랜치**: 이 프로젝트의 기본(default) 브랜치는 `develop` 브랜치입니다. 모든 새로운 작업의 시작과 반영은 특별한 요청이 없는 한 `develop` 브랜치를 기준으로 진행합니다.
5. **E2E 및 통합 테스트의 누락 없는 시나리오 검증**: 파일 업로드 등 외부 부수 효과(Side Effect)를 동반하는 핵심 로직은 E2E 테스트에서 실제와 동일한 형태(예: 테스트 파일 첨부)로 검증해야 합니다. 단위 테스트에서 외부 서비스(Supabase Storage 등)를 Mocking할 경우 호출 대상과 누락된 로직이 없는지 엄격히 확인해야 합니다. ('Happy Path' 혹은 텍스트 입력만 검증하는 반쪽짜리 테스트 지양)
6. **인프라 설정(RLS)과 애플리케이션 코드의 동기화**: DB 마이그레이션(SQL)에 기재된 보안/운영 정책(예: Service Role Key 사용 의도)과 실제 애플리케이션 코드(예: `createClient`에서 Anon Key 사용)가 불일치하지 않도록 교차 검증해야 합니다. 외부 스토리지나 DB 접근 권한 설정(RLS)은 구현 즉시 실제 작동 여부를 테스트해야 합니다.
7. **Node.js 환경에서의 Web API(File) 객체 처리 주의**: Next.js Server Action(Node.js 환경)에서 `FormData`로부터 추출한 Web API 표준 `File` 객체를 서드파티 SDK에 직접 전달하면 호환성 문제로 실패할 수 있습니다. 서버 환경에서 파일을 외부로 전송할 때는 반드시 `await image.arrayBuffer()`를 통해 `Buffer`로 변환한 후 전송해야 합니다.
8. **배포 전 빌드 및 타입 체크(Type Check)**: Vercel 배포 시에는 TypeScript 타입 검사가 실행되므로, 로컬 환경(Next.js dev 모드)에서 타입 오류를 무심코 지나치면 배포가 실패하게 됩니다. 커밋하거나 배포 브랜치에 병합하기 전, 반드시 로컬에서 `npm run build` 또는 `npx tsc --noEmit`를 실행하여 타입 오류나 빌드 에러가 없는지 미리 확인하세요.

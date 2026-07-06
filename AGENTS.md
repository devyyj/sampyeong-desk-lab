<!-- BEGIN:nextjs-agent-rules -->
# 여러분이 아는 Next.js가 아닙니다

이 버전에는 큰 변경 사항이 포함되어 있습니다 — API, 규칙, 파일 구조가 학습 데이터와 다를 수 있습니다. 코드를 작성하기 전에 `node_modules/next/dist/docs/`에 있는 관련 가이드를 읽어보세요. 지원 중단(deprecation) 알림에 주의하세요.
<!-- END:nextjs-agent-rules -->

# 프로젝트 지침

1. **테스트 주도 개발 (TDD)**: 모든 새로운 기능과 버그 수정은 TDD 원칙을 따라야 합니다. 실패하는 테스트를 먼저 작성한 다음, 테스트를 통과하도록 코드를 구현하고 리팩터링하세요.
2. **상세한 주석**: 복잡한 로직, 결정 사항 및 명확하지 않은 구현 세부 사항의 "이유(why)"를 설명하는 상세한 주석으로 코드를 철저하게 문서화해야 합니다.
3. **Server Actions와 useActionState (React 19+)**: 클라이언트 컴포넌트에서 `useActionState`와 함께 Server Action을 사용할 때, Action 함수의 첫 번째 인자는 **반드시 `prevState`**가 되어야 하고, 두 번째 인자로 `FormData`가 전달됩니다 (예: `async function action(prevState: any, formData: FormData)`). `FormData`만 인자로 받는 기존 방식은 런타임에 Null 오류를 발생시킬 수 있으니 주의하세요.

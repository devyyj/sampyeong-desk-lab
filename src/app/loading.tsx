/**
 * 모든 화면 공통 로딩 스켈레톤(루트 Suspense 경계).
 *
 * 왜 필요한가: 탭 페이지는 모두 동적 렌더링(세션 쿠키·DB 조회)이라 미리 받아 둘(prefetch) 수 없고,
 * loading.tsx가 없으면 Next는 서버가 다음 화면을 다 그릴 때까지 이전 화면을 그대로 둔다 → 탭을 눌러도 반응이 늦다.
 * 이 파일이 있으면 공통 레이아웃과 이 스켈레톤까지는 미리 받아 둘 수 있어, 누르는 즉시 화면이 바뀌고 내용만 뒤이어 채워진다.
 * 루트에 하나만 두면 하위 경로 전부에 적용된다(화면마다 모양을 맞추기보다 공통 골격 하나로 충분하다고 판단).
 *
 * 모양: 카드 몇 장. 탭 첫 화면은 제목 글자 없이 ScreenTitle의 위쪽 여백(pt-3, lg:pt-6)만 있으므로
 * 실제 화면으로 바뀔 때 위쪽이 튀지 않게 같은 여백을 둔다.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="불러오는 중" aria-busy="true" className="pt-3 lg:pt-6">
      <div className="space-y-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}

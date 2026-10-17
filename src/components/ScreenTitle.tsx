/**
 * 탭 첫 화면(피드·보드게임·회원 명부·MY)의 제목.
 * 화면 맨 위 로고 헤더와 하단 탭바(현재 탭 강조)만으로 어느 화면인지 충분히 알 수 있어,
 * 큰 제목 글자는 공간만 차지한다는 의견에 따라 화면에서 뺐다.
 * 다만 스크린 리더 사용자가 화면 이름을 알 수 있도록 h1은 sr-only로 남긴다.
 *
 * 뒤로 가기가 있는 하위 화면(상세·편집)은 여전히 TopBar를 쓴다.
 * 여백: 제목 줄(TopBar 48px + mb-2)이 빠진 자리를 위쪽 여백(pt-3, 넓은 화면은 로고 헤더가 없어 lg:pt-6)으로 대신해,
 * 첫 요소가 로고 헤더에 바짝 붙지 않게 한다.
 */
export default function ScreenTitle({ title }: { title: string }) {
  return (
    <div className="pt-3 lg:pt-6">
      <h1 className="sr-only">{title}</h1>
    </div>
  );
}

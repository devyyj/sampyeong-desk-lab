import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 모드 표시(N 버튼)는 화면 네 모서리 어디에 두어도 모바일 UI를 가린다
  // (왼쪽 아래 탭바 '피드', 오른쪽 아래 ＋ 버튼, 위쪽 양끝 작성 화면의 취소·게시). 그래서 끈다.
  // 컴파일·런타임 오류 표시는 꺼지지 않으며, 운영 빌드에는 원래 나오지 않는다.
  devIndicators: false,
  // 활동 기록은 게시글로 합쳐졌다(종류 구분도 없앰, 2026-10-17 설계). 북마크·공유된 예전 주소가 깨지지 않게 영구 이동시킨다.
  // 이관 때 게시글 id를 활동 id 그대로 두었으므로 상세 주소는 id만 바꿔 끼우면 된다.
  async redirects() {
    return [
      { source: '/activities', destination: '/', permanent: true },
      { source: '/activities/:id', destination: '/posts/:id', permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      // 프로필 사진(장당 최대 10MB)은 Server Action 본문으로 서버에 올린다. 기본 1MB면 1MB 넘는 사진이 실패한다.
      // 10MB 사진 + 다른 폼 필드가 들어가도록 여유를 둔다. 게시글 사진은 브라우저가 Storage에 직접 올려 이 제한과 무관하다.
      bodySizeLimit: '11mb',
    },
    // proxy(이 저장소는 아직 src/middleware.ts)가 있으면 Next가 요청 본문을 메모리에 복제해 두는데, 기본 한도 10MB를 넘으면
    // 본문이 잘린다. 위 Server Action 한도와 맞춘다.
    proxyClientMaxBodySize: '11mb',
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

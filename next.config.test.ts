// @vitest-environment node
import { describe, it, expect } from 'vitest';
import nextConfig from './next.config';

describe('예전 활동 기록 주소 리디렉트(설계 §5.1)', () => {
  it('/activities는 피드의 활동 기록 필터로, /activities/[id]는 같은 id의 게시글 상세로 영구 이동(308)', async () => {
    expect(await nextConfig.redirects!()).toEqual(
      expect.arrayContaining([
        { source: '/activities', destination: '/?kind=activity', permanent: true },
        { source: '/activities/:id', destination: '/posts/:id', permanent: true },
      ]),
    );
  });
});

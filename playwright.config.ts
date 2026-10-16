import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    // 기본은 dev 서버(3000). 프로덕션 빌드(next start -p 3100 등)로 돌릴 때는 E2E_BASE_URL로 바꾼다.
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // 모바일 전용 흐름은 아래 mobile 프로젝트에서만 돈다(같은 DB 쓰기를 두 번 하지 않게).
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      // 모바일 중심 UI(로고 헤더·하단 탭바·바텀시트) 검증. 헤드리스로 iPhone 13 뷰포트·터치를 흉내 낸다.
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
});

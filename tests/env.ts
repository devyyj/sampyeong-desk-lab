import { loadEnvConfig } from '@next/env';

// .env.local을 읽는 부수 효과 전용 모듈. src/db는 import 시점에 DATABASE_URL을 읽으므로,
// 테스트 파일에서 DB 모듈보다 먼저 import되도록 helpers.ts 맨 위에서 불러온다.
loadEnvConfig(process.cwd());

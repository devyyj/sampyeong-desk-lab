// npm run bootstrap:pins 진입점. 로직(bootstrap-pins.ts)과 분리해 테스트가 import해도 DB에 접속하지 않게 한다.
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../drizzle/schema';
import { bootstrapPins } from './bootstrap-pins';

const ADMIN_USERNAME = 'youngyong.jo';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 환경 변수가 필요합니다.');
  console.log(`target DB host: ${new URL(url).host}`);

  const client = postgres(url, { prepare: false });
  try {
    console.log(await bootstrapPins(drizzle(client, { schema }), ADMIN_USERNAME));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

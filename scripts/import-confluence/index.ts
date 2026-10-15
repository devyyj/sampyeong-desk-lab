// Confluence → DB import 진입점.
// 사용법: npm run import:confluence -- [--dry-run] [--reset --yes]
// 로직은 cli.ts에 있다(테스트가 모듈을 import해도 import가 실행되지 않도록 진입점을 분리).
import { main } from './cli';

main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

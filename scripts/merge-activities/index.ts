// 활동 기록 → 게시글 이관 진입점.
// 사용법: npm run merge:activities            (dry-run: 보고서만)
//         npm run merge:activities -- --apply (실제 적용)
// 로직은 cli.ts에 있다(테스트가 모듈을 import해도 DB에 접속하지 않도록 진입점을 분리).
import { main } from './cli';

main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

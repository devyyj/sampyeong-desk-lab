// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { renderReport } from './report';

describe('renderReport (dry-run 보고서)', () => {
  const report = renderReport({
    generatedAt: '2026-10-16T22:00:00.000Z',
    presidentName: '반갑읍니다 (youngyong.jo)',
    summary: { posts: 1, images: 2, likes: 1, comments: 0 },
    items: [
      {
        title: '제 7회 방탈출 정기모임',
        date: '2026-07-31',
        type: 'ESCAPE_ROOM',
        seasonName: '시즌 4',
        photos: 2,
        before: '- **제 7회 방탈출 정기모임**\n    - 테마',
        after: '• 테마',
      },
    ],
  });

  it('요약(옮길 건수·작성자)을 맨 위에 둔다', () => {
    expect(report).toContain('# 활동 기록 → 게시글 이관 dry-run 보고서');
    expect(report).toContain('작성자: 반갑읍니다 (youngyong.jo)');
    expect(report).toContain('| 게시글 | 1 |');
    expect(report).toContain('| 사진 | 2 |');
  });

  it('건마다 메타 정보와 변환 전·후 본문을 코드 블록으로 보여준다', () => {
    expect(report).toContain('## 1. 제 7회 방탈출 정기모임');
    expect(report).toContain('2026-07-31 · 방탈출 · 시즌 4 · 사진 2장');
    expect(report).toContain('```\n- **제 7회 방탈출 정기모임**\n    - 테마\n```');
    expect(report).toContain('```\n• 테마\n```');
  });
});

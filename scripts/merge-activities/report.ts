import { getActivityType } from '../../src/lib/activity-types';

export type ReportItem = {
  title: string;
  date: string;
  type: string;
  seasonName: string;
  photos: number;
  before: string;
  after: string;
};

/**
 * dry-run 보고서(Markdown). 사람이 91건의 변환 전·후를 훑어보고 --apply 여부를 정하는 데 쓴다.
 * 본문에 백틱 3개가 없음을 이관 대상 조사에서 확인했으므로 코드 블록으로 감싼다.
 */
export function renderReport(input: {
  generatedAt: string;
  presidentName: string;
  summary: { posts: number; images: number; likes: number; comments: number };
  items: ReportItem[];
}): string {
  const { summary } = input;
  const head = [
    '# 활동 기록 → 게시글 이관 dry-run 보고서',
    '',
    `- 생성 시각: ${input.generatedAt}`,
    `- 작성자: ${input.presidentName}`,
    '- 이 보고서는 DB에 아무것도 쓰지 않은 상태에서 만들었다. 적용은 `--apply`로 한다.',
    '',
    '| 항목 | 건수 |',
    '|---|---|',
    `| 게시글 | ${summary.posts} |`,
    `| 사진 | ${summary.images} |`,
    `| 좋아요 | ${summary.likes} |`,
    `| 댓글(게시글로 이동) | ${summary.comments} |`,
    '',
  ];
  const body = input.items.flatMap((item, i) => [
    `## ${i + 1}. ${item.title}`,
    '',
    `${item.date} · ${getActivityType(item.type).label} · ${item.seasonName} · 사진 ${item.photos}장`,
    '',
    '변환 전(Markdown):',
    '',
    '```',
    item.before,
    '```',
    '',
    '변환 후(게시글 본문):',
    '',
    '```',
    item.after,
    '```',
    '',
  ]);
  return [...head, ...body].join('\n');
}

import { db } from '@/db';
import PostForm from '@/components/PostForm';

export const dynamic = 'force-dynamic';

/**
 * 새 게시글 작성(전체 화면 작성 모드). 상단 바·제출 버튼·태그 칸은 PostForm이 그린다.
 * 시즌(선택 입력) 목록만 서버에서 넘긴다. 모임 날짜·시즌은 기본값 없이 비워 둔다(입력한 경우에만 카드에 보이게).
 */
export default async function PostWritePage() {
  const seasons = await db.query.seasons.findMany({ columns: { id: true, name: true } });
  return <PostForm mode="create" seasons={seasons} />;
}

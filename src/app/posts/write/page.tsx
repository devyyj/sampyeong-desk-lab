import { db } from '@/db';
import PostForm from '@/components/PostForm';
import { todayKst } from '@/lib/time';

export const dynamic = 'force-dynamic';

/**
 * 새 게시글 작성(전체 화면 작성 모드). 상단 바·제출 버튼·종류 전환은 PostForm이 그린다.
 * 활동 기록을 고를 때 쓸 시즌 목록과 모임 날짜 기본값(오늘, 한국 날짜)을 서버에서 넘긴다.
 */
export default async function PostWritePage() {
  const seasons = await db.query.seasons.findMany({ columns: { id: true, name: true } });
  return <PostForm mode="create" seasons={seasons} today={todayKst()} />;
}

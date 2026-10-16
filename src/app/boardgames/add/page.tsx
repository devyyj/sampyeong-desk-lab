import { getBoardGameCategories } from '@/lib/boardgame-categories';
import { AddBoardGameForm } from './add-form';

export const dynamic = 'force-dynamic';

/** 보드게임 등록 화면. 카테고리 추천 목록을 DB에서 읽어 클라이언트 폼에 넘긴다(로그인 확인은 route-guard가 한다). */
export default async function AddBoardGamePage() {
  return <AddBoardGameForm categories={await getBoardGameCategories()} />;
}

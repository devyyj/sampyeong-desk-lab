'use client';

import { deleteBoardGame } from '@/app/actions/boardgame';
import { useRouter } from 'next/navigation';

export default function DeleteBoardGameButton({ id }: { id: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    if (confirm('정말로 삭제하시겠습니까?')) {
      await deleteBoardGame(id);
      router.refresh();
    }
  };

  return (
    <button onClick={handleDelete} className="text-xs text-red-500 hover:underline bg-red-100 px-2 py-1 rounded">
      삭제
    </button>
  );
}

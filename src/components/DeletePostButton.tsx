'use client';

import { deletePost } from '@/app/actions/post';
import { useRouter } from 'next/navigation';

export default function DeletePostButton({ id }: { id: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    if (confirm('정말로 삭제하시겠습니까?')) {
      await deletePost(id);
      router.refresh();
    }
  };

  return (
    <button onClick={handleDelete} className="text-xs text-red-500 hover:underline">
      삭제
    </button>
  );
}

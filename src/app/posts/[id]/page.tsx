import { notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getPostView } from '@/lib/feed';
import { isUuid } from '@/lib/uuid';
import TopBar from '@/components/TopBar';
import PostCard from '@/components/PostCard';

export const dynamic = 'force-dynamic';

/**
 * 게시글 상세(자유글·활동 기록 공용). 설계 §5.4.
 * 본문 전체(접지 않음), 사진(활동형은 회원에게만 signed URL), 좋아요, 댓글 펼침.
 * 예전 /activities/[id]는 같은 id로 이곳에 리디렉트된다(이관 시 id 유지).
 */
export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 형식이 다른 id로 uuid 컬럼을 조회하면 500이 나므로 바로 404.
  if (!isUuid(id)) notFound();

  const session = await getSession();
  const viewer = session ? { id: session.userId, isAdmin: session.isAdmin } : null;
  const item = await getPostView(id, viewer);
  if (!item) notFound();

  return (
    <div>
      <TopBar title={item.activity ? '활동 기록' : '게시글'} backHref="/" backLabel="피드로 돌아가기" />
      <PostCard
        item={item}
        variant="detail"
        viewer={viewer}
        loginHref={`/login?redirect=${encodeURIComponent(`/posts/${item.id}`)}`}
      />
    </div>
  );
}

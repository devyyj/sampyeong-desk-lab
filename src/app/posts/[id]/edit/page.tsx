import { db } from "@/db";
import { posts } from "../../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import PostForm from "@/components/PostForm";
import { postImagePublicUrl, type PostKind } from "@/lib/post-images";
import { createSignedPhotoUrls } from "@/lib/storage-admin";
import { getAdminUser } from "@/lib/admin";
import { isUuid } from "@/lib/uuid";

export const dynamic = 'force-dynamic';

/**
 * 게시글 수정. 작성자 본인과 관리자만 열 수 있다(관리자 여부는 세션이 아니라 DB로 확인).
 * 활동 기록의 기존 사진은 비공개 버킷이라 signed URL로 미리보기를 만든다(이 화면은 회원만 오므로 발급해도 된다).
 */
export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');
  // 형식이 다른 id로 uuid 컬럼을 조회하면 500이 나므로 바로 돌려보낸다.
  if (!isUuid(id)) redirect('/');

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { images: { orderBy: (images, { asc }) => [asc(images.position)] } },
  });
  if (!post) redirect('/');
  if (post.authorId !== session.userId && !(await getAdminUser())) redirect('/');

  const isActivity = post.kind === 'activity';
  const paths = post.images.map((img) => img.storagePath);
  const urls = isActivity ? await createSignedPhotoUrls(paths) : paths.map(postImagePublicUrl);
  const seasons = isActivity ? await db.query.seasons.findMany({ columns: { id: true, name: true } }) : [];

  // 상단 바(취소 | 게시글 수정 | 수정완료)는 PostForm이 그린다.
  return (
    <PostForm
      mode="edit"
      seasons={seasons}
      post={{
        id: post.id,
        content: post.content,
        kind: post.kind as PostKind,
        // 서명에 실패한 사진도 목록에는 남긴다(빼기·유지를 고를 수 있게). 미리보기만 빈 칸이 된다.
        images: post.images.map((img, i) => ({ id: img.id, url: urls[i] ?? '' })),
        activity: isActivity
          ? { title: post.title ?? '', activityType: post.activityType ?? 'OTHER', activityDate: post.activityDate ?? '', seasonId: post.seasonId ?? 0 }
          : null,
      }}
    />
  );
}

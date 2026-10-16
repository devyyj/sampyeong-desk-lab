'use server';

import { db } from '@/db';
import { posts, postImages, seasons } from '../../../drizzle/schema';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createPostImageUploadUrls, getPostImageInfo, removePostImages } from '@/lib/storage-admin';
import { checkImageFiles, extensionFor, MAX_POST_IMAGES, TOO_MANY_IMAGES } from '@/lib/post-images';
import { isUuid } from '@/lib/uuid';
import { getAdminUser } from '@/lib/admin';
import { parsePostMeta, type PostMeta } from '@/lib/post-meta';

/*
 * 게시글 사진 흐름(설계 §5, 방식 A)
 * 1. 브라우저가 requestPostImageUploads로 서명 업로드 토큰을 받는다(로그인·규칙 검사, 경로는 서버가 정함).
 * 2. 브라우저가 Storage에 직접 올린다(Server Action 본문 한도와 무관하게 10MB × 10장).
 * 3. createPost/updatePost가 경로를 받아, 본인 폴더의 경로인지·실제로 올라갔는지·규칙을 지키는지 확인하고 저장한다.
 * Server Action은 누구나 직접 호출할 수 있으므로 3번의 검사가 최종 방어선이다.
 *
 * 양식 통합(설계: 2026-10-17-unified-post-form-design.md): 글 종류 구분 없이 사진·내용에 선택 정보(태그·모임 날짜·시즌)를 붙인다.
 * 사진은 모두 비공개 버킷(POST_PHOTOS_BUCKET)에 올라가 회원에게만 보인다.
 * 수정·삭제는 작성자 본인 또는 관리자(관리자 여부는 세션이 아니라 DB로 확인 — getAdminUser).
 */

type FileSpec = { type: string; size: number };

const LOGIN_REQUIRED = { error: '로그인이 필요합니다.' };
const BAD_PATH = { error: '잘못된 사진 경로입니다.' };
const NOT_UPLOADED = { error: '업로드되지 않은 사진이 있습니다. 다시 시도해주세요.' };

/** 사진 업로드 전에 경로별 서명 업로드 토큰을 발급한다. existingCount는 수정 화면에서 남겨 둔 기존 사진 수. */
export async function requestPostImageUploads(
  files: FileSpec[],
  existingCount = 0,
): Promise<{ uploads: { path: string; token: string }[] } | { error: string }> {
  const session = await getSession();
  if (!session) return LOGIN_REQUIRED;
  if (!Array.isArray(files) || files.length === 0) return { error: '올릴 사진이 없습니다.' };

  // 클라이언트가 보낸 값이라 숫자가 아닐 수도 있다. 음수로 개수 검사를 피하지 못하게 0 이상으로 맞춘다.
  const existing = Number.isInteger(existingCount) && existingCount > 0 ? existingCount : 0;
  const invalid = checkImageFiles(files.map((f) => ({ type: String(f?.type ?? ''), size: Number(f?.size) || 0 })), existing);
  if (invalid) return { error: invalid };

  // 경로는 서버가 정한다: 로그인한 회원 폴더 + 새 uuid + MIME 기준 확장자. 사용자가 정한 파일 이름은 쓰지 않는다.
  const paths = files.map((f) => `${session.userId}/${uuidv4()}.${extensionFor(f.type)}`);
  try {
    return { uploads: await createPostImageUploadUrls(paths) };
  } catch (e) {
    console.error('Signed upload URL error', e);
    return { error: '사진 업로드를 준비하지 못했습니다. 다시 시도해주세요.' };
  }
}

/**
 * 브라우저가 보낸 새 사진 경로를 검사한다. 통과하면 null, 아니면 돌려줄 오류.
 * - 형식: `{본인 userId}/{uuid}.{확장자}` 그대로여야 한다(다른 회원 폴더, ../, 하위 경로 차단).
 * - 중복 경로 금지(같은 파일을 두 번 등록하면 하나를 지울 때 다른 쪽이 깨진다).
 * - Storage에 실제로 있고, 크기·형식 규칙을 지켜야 한다. 서명 업로드 URL은 크기·형식을 강제하지 않으므로
 *   여기서 걸린 파일은 본인 폴더의 쓸모없는 파일이라 바로 지운다.
 */
async function checkNewImagePaths(userId: string, paths: string[]): Promise<{ error: string } | null> {
  if (paths.length === 0) return null;
  const pattern = new RegExp(`^${userId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.[a-z0-9]{1,10}$`);
  if (paths.some((p) => !pattern.test(p)) || new Set(paths).size !== paths.length) return BAD_PATH;

  const infos = await getPostImageInfo(paths);
  if (infos.some((info) => info === null)) return NOT_UPLOADED;
  const invalid = checkImageFiles(infos.map((info) => ({ type: info!.contentType ?? '', size: info!.size ?? 0 })));
  if (invalid) {
    await removePostImages(paths);
    return { error: invalid };
  }
  return null;
}

const imagePathsOf = (formData: FormData) => formData.getAll('imagePaths').map(String);

/**
 * 본문을 저장할 모양으로: 앞뒤 공백을 지우고 줄바꿈을 LF로 맞춘다.
 * 브라우저는 textarea 줄바꿈을 CRLF로 보낼 수 있어, 그대로 두면 같은 글이 이관 글(LF)과 다른 줄바꿈으로 저장된다.
 */
const contentOf = (formData: FormData) => String(formData.get('content') ?? '').replace(/\r\n?/g, '\n').trim();

/** 선택 정보(태그·모임 날짜·시즌) 검사 + 고른 시즌이 실제로 있는지(DB). 시즌을 고르지 않았으면 DB를 보지 않는다. */
async function postMetaOf(formData: FormData): Promise<PostMeta | { error: string }> {
  const meta = parsePostMeta(formData);
  if ('error' in meta || meta.seasonId === null) return meta;
  const season = await db.query.seasons.findFirst({ where: eq(seasons.id, meta.seasonId) });
  return season ? meta : { error: '시즌을 다시 골라주세요.' };
}

/** 작성자 본인이거나 관리자인지. 본인 글이면 DB를 더 조회하지 않는다. */
async function canManage(authorId: string, userId: string): Promise<boolean> {
  return authorId === userId || (await getAdminUser()) !== null;
}

export async function createPost(prevState: unknown, formData: FormData) {
  const session = await getSession();
  if (!session) return LOGIN_REQUIRED;

  const content = contentOf(formData);
  if (!content) return { error: '내용을 입력해주세요.' };

  const paths = imagePathsOf(formData);
  if (paths.length > MAX_POST_IMAGES) return { error: TOO_MANY_IMAGES };

  try {
    const meta = await postMetaOf(formData);
    if ('error' in meta) return meta;

    const pathError = await checkNewImagePaths(session.userId, paths);
    if (pathError) return pathError;

    const values = { content, authorId: session.userId, ...meta };
    // 글과 사진 행을 한 트랜잭션으로 저장해, 사진 행만 빠진 글이 생기지 않게 한다.
    await db.transaction(async (tx) => {
      const [post] = await tx.insert(posts).values(values).returning({ id: posts.id });
      if (paths.length > 0) {
        await tx.insert(postImages).values(paths.map((storagePath, position) => ({ postId: post.id, storagePath, position })));
      }
    });
  } catch (e) {
    console.error('Create post error', e);
    return { error: '게시글 작성 중 오류가 발생했습니다.' };
  }

  revalidatePath('/');
  redirect('/');
}

/**
 * 게시글 수정. 내용과 함께 사진을 뺄 수 있고(removeImageIds) 새 사진을 더할 수 있다(imagePaths).
 * 순서는 남은 기존 사진(원래 순서) → 새 사진. (post_id, position) 고유 제약이 있어 번호를 하나씩 옮기지 않고
 * 사진 행을 모두 지운 뒤 새 순서로 다시 넣는다(같은 트랜잭션).
 * 선택 정보(태그·모임 날짜·시즌)도 폼 값으로 바꾼다(비우면 지운다).
 */
export async function updatePost(prevState: unknown, formData: FormData) {
  const session = await getSession();
  if (!session) return LOGIN_REQUIRED;

  const id = formData.get('id');
  const content = contentOf(formData);
  if (!isUuid(id) || !content) return { error: '잘못된 요청입니다.' };

  const newPaths = imagePathsOf(formData);
  const removeIds = new Set(formData.getAll('removeImageIds').map(String));

  let removedPaths: string[] = [];
  try {
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      with: { images: { orderBy: (images, { asc }) => [asc(images.position)] } },
    });
    if (!post) return { error: '찾을 수 없습니다.' };
    if (!(await canManage(post.authorId, session.userId))) return { error: '수정 권한이 없습니다.' };

    const meta = await postMetaOf(formData);
    if ('error' in meta) return meta;

    // 이 글의 사진만 뺄 수 있다. 다른 글의 사진 id가 섞여 와도 무시된다.
    const kept = post.images.filter((img) => !removeIds.has(img.id));
    const removed = post.images.filter((img) => removeIds.has(img.id));
    if (kept.length + newPaths.length > MAX_POST_IMAGES) return { error: TOO_MANY_IMAGES };

    // 관리자가 남의 글에 사진을 더하면 관리자 본인 폴더에 올라간다(경로 규칙은 올린 사람 기준).
    const pathError = await checkNewImagePaths(session.userId, newPaths);
    if (pathError) return pathError;

    const ordered = [...kept.map((img) => img.storagePath), ...newPaths];
    await db.transaction(async (tx) => {
      await tx.update(posts).set({ content, ...meta, updatedAt: new Date() }).where(eq(posts.id, post.id));
      await tx.delete(postImages).where(eq(postImages.postId, post.id));
      if (ordered.length > 0) {
        await tx.insert(postImages).values(ordered.map((storagePath, position) => ({ postId: post.id, storagePath, position })));
      }
    });
    removedPaths = removed.map((img) => img.storagePath);
  } catch (e) {
    console.error('Update post error', e);
    return { error: '게시글 수정 중 오류가 발생했습니다.' };
  }

  // 파일은 DB 반영이 끝난 뒤에 지운다(트랜잭션이 실패했는데 파일만 사라지는 일이 없게). 실패해도 로그만 남는다.
  await removePostImages(removedPaths);
  revalidatePath('/');
  redirect('/');
}

export async function deletePost(id: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('로그인이 필요합니다.');
  }
  if (!isUuid(id)) throw new Error('잘못된 요청입니다.');

  const post = await db.query.posts.findFirst({ where: eq(posts.id, id), with: { images: true } });
  if (!post || !(await canManage(post.authorId, session.userId))) {
    throw new Error('삭제 권한이 없습니다.');
  }

  try {
    // post_images·댓글·좋아요 행은 FK cascade로 함께 지워진다. Storage 파일은 cascade 대상이 아니라 따로 지운다.
    await db.delete(posts).where(eq(posts.id, post.id));
  } catch (e) {
    console.error('Delete post error', e);
    throw new Error('게시글 삭제 중 오류가 발생했습니다.');
  }
  await removePostImages(post.images.map((img) => img.storagePath));
  revalidatePath('/');
}

'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createPost, updatePost, requestPostImageUploads } from '@/app/actions/post';
import { createClient } from '@/utils/supabase/client';
import { checkImageFiles, MAX_POST_IMAGES } from '@/lib/post-images';

type ExistingImage = { id: string; url: string };
type NewImage = { file: File; preview: string };
type ActionState = { error?: string } | null;

/**
 * 게시글 작성·수정 공용 폼.
 *
 * 사진은 Server Action 본문으로 보내지 않는다(기본 1MB 한도, 10MB × 10장). 대신 제출할 때
 * 1) requestPostImageUploads로 서명 업로드 토큰을 받고 2) 브라우저가 Storage에 직접 올린 뒤
 * 3) 올린 경로만 createPost/updatePost에 보낸다(설계 §5). 서버가 경로·실제 파일을 다시 검사한다.
 *
 * 사진 규칙(개수·크기·형식)은 고르는 즉시 검사해 바로 알려 준다. 수정 화면의 개수는 "남겨 둔 기존 사진 + 새 사진"이다.
 */
export default function PostForm({ mode, post }: { mode: 'create' | 'edit'; post?: { id: string; content: string; images: ExistingImage[] } }) {
  const action = mode === 'create' ? createPost : updatePost;
  const [state, dispatch, isSaving] = useActionState<ActionState, FormData>(
    action as (prev: ActionState, formData: FormData) => Promise<ActionState>,
    null,
  );
  const existing = post?.images ?? [];
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [newImages, setNewImages] = useState<NewImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const keptCount = existing.length - removedIds.size;
  const total = keptCount + newImages.length;

  // 폼을 떠날 때 남은 미리보기 blob URL을 해제한다(메모리 누수 방지). newImages를 의존성으로 두면
  // 목록이 바뀔 때마다 아직 보이는 미리보기까지 해제되므로, 최신 목록을 ref로 들고 언마운트 때만 해제한다.
  // (사용자가 뺀 사진은 빼는 순간 해제한다.)
  const latestImages = useRef(newImages);
  useEffect(() => {
    latestImages.current = newImages;
  }, [newImages]);
  useEffect(() => () => latestImages.current.forEach((img) => URL.revokeObjectURL(img.preview)), []);

  const pickFiles = (files: File[]) => {
    const all = [...newImages.map((img) => img.file), ...files];
    const invalid = checkImageFiles(all, keptCount);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setNewImages([...newImages, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const toggleRemoved = (id: string) => {
    const next = new Set(removedIds);
    if (next.has(id)) {
      // 삭제 표시를 풀면 사진이 다시 늘어나므로 10장을 넘지 않는지 본다.
      if (total + 1 > MAX_POST_IMAGES) {
        setError(checkImageFiles([], total + 1));
        return;
      }
      next.delete(id);
    } else {
      next.add(id);
    }
    setRemovedIds(next);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // 파일 입력은 이름이 없어 FormData에 들어가지 않는다(파일은 아래에서 Storage로 따로 올린다).
    setError(null);

    if (newImages.length > 0) {
      setUploading(true);
      try {
        const files = newImages.map((img) => img.file);
        const issued = await requestPostImageUploads(files.map((f) => ({ type: f.type, size: f.size })), keptCount);
        if ('error' in issued) {
          setError(issued.error);
          return;
        }
        const storage = createClient().storage.from('post_images');
        const results = await Promise.all(
          issued.uploads.map(({ path, token }, i) => storage.uploadToSignedUrl(path, token, files[i])),
        );
        const failed = files.filter((_, i) => results[i].error);
        if (failed.length > 0) {
          // 일부만 올라간 상태로 글을 저장하지 않는다. 사용자가 다시 시도하게 한다.
          setError(`사진을 올리지 못했습니다(${failed.map((f) => f.name).join(', ')}). 다시 시도해주세요.`);
          return;
        }
        issued.uploads.forEach(({ path }) => formData.append('imagePaths', path));
      } catch {
        setError('사진을 올리지 못했습니다. 다시 시도해주세요.');
        return;
      } finally {
        setUploading(false);
      }
    }
    removedIds.forEach((id) => formData.append('removeImageIds', id));
    // useActionState의 dispatch는 transition 안에서 호출해야 pending 상태가 동작한다.
    startTransition(() => dispatch(formData));
  };

  const busy = uploading || isSaving;
  const shownError = error ?? state?.error;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {post && <input type="hidden" name="id" value={post.id} />}

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-foreground mb-1">
          내용 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="content"
          name="content"
          required
          rows={5}
          defaultValue={post?.content}
          className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          placeholder="무슨 생각을 하고 계신가요?"
        />
      </div>

      {existing.length > 0 && (
        <div role="group" aria-label="기존 사진" className="flex flex-wrap gap-2">
          {existing.map((img, i) => {
            const removed = removedIds.has(img.id);
            return (
              <div key={img.id} className="relative w-24 h-24">
                <img
                  src={img.url}
                  alt={`기존 사진 ${i + 1}`}
                  className={`w-full h-full object-cover rounded-lg bg-muted ${removed ? 'opacity-30 grayscale' : ''}`}
                />
                <button
                  type="button"
                  aria-label={`기존 사진 ${i + 1} 삭제`}
                  aria-pressed={removed}
                  onClick={() => toggleRemoved(img.id)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs font-bold hover:bg-black"
                >
                  {removed ? '↺' : '×'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <label htmlFor="images" className="block text-sm font-medium text-foreground mb-1">
          사진 첨부 (선택)
        </label>
        <input
          type="file"
          id="images"
          multiple
          accept="image/*"
          onChange={(e) => {
            pickFiles([...(e.target.files ?? [])]);
            // 같은 파일을 다시 고를 수 있게 비운다(고른 파일은 state에 있다).
            e.target.value = '';
          }}
          className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 text-sm text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground mt-1">
          <span>{`사진 ${total} / ${MAX_POST_IMAGES}장`}</span> · 한 장에 10MB 이하
        </p>
      </div>

      {newImages.length > 0 && (
        <div role="group" aria-label="새 사진" className="flex flex-wrap gap-2">
          {newImages.map((img, i) => (
            <div key={img.preview} className="relative w-24 h-24">
              <img src={img.preview} alt={`새 사진 ${i + 1}`} className="w-full h-full object-cover rounded-lg bg-muted" />
              <button
                type="button"
                aria-label={`새 사진 ${i + 1} 빼기`}
                onClick={() => {
                  URL.revokeObjectURL(img.preview);
                  setNewImages(newImages.filter((_, j) => j !== i));
                }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs font-bold hover:bg-black"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {shownError && <p className="text-sm text-red-500 font-medium">{shownError}</p>}

      <div className="flex justify-end gap-3 pt-2">
        {mode === 'edit' && (
          <Link href="/" className="px-5 py-2.5 rounded-full font-medium hover:bg-muted transition-colors">
            취소
          </Link>
        )}
        <button
          type="submit"
          disabled={busy}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-60"
        >
          {uploading ? '사진 올리는 중…' : mode === 'create' ? '게시하기' : '수정완료'}
        </button>
      </div>
    </form>
  );
}

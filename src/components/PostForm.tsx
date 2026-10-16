'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPost, updatePost, requestPostImageUploads } from '@/app/actions/post';
import { createClient } from '@/utils/supabase/client';
import { checkImageFiles, MAX_POST_IMAGES } from '@/lib/post-images';
import { CameraIcon } from './icons';
import FormHeader from './FormHeader';

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

  const thumbClass = 'relative shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-muted';
  const thumbButtonClass =
    'absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 text-white text-sm font-bold flex items-center justify-center';

  return (
    <form onSubmit={onSubmit}>
      {post && <input type="hidden" name="id" value={post.id} />}

      {/* 게시글·보드게임·회원 생성 공통 상단 바. 탭바는 이 화면에서 숨겨진다(nav.hidesAppChrome). */}
      <FormHeader
        title={mode === 'create' ? '새 게시글' : '게시글 수정'}
        cancelHref="/"
        submitLabel={mode === 'create' ? '게시하기' : '수정완료'}
        busy={busy}
        busyLabel={uploading ? '사진 올리는 중…' : undefined}
      />

      {/* 사진을 먼저 고르는 흐름(모임 직후 사진부터 올리는 사용 장면). 한 줄 가로 스크롤에 추가 칸 + 미리보기를 둔다. */}
      <div className="-mx-4 px-4 pb-4 flex gap-2 overflow-x-auto no-scrollbar">
        <label
          htmlFor="images"
          className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground cursor-pointer active:bg-muted"
        >
          <CameraIcon size={26} />
          <span className="text-xs tabular-nums">{`사진 ${total} / ${MAX_POST_IMAGES}장`}</span>
        </label>
        <input
          type="file"
          id="images"
          // 칸(label)에는 아이콘·개수만 보이므로 입력의 이름은 aria-label로 따로 준다.
          aria-label="사진 첨부 (선택)"
          multiple
          accept="image/*"
          onChange={(e) => {
            pickFiles([...(e.target.files ?? [])]);
            // 같은 파일을 다시 고를 수 있게 비운다(고른 파일은 state에 있다).
            e.target.value = '';
          }}
          className="sr-only"
        />

        {existing.length > 0 && (
          <div role="group" aria-label="기존 사진" className="flex gap-2">
            {existing.map((img, i) => {
              const removed = removedIds.has(img.id);
              return (
                <div key={img.id} className={thumbClass}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={`기존 사진 ${i + 1}`}
                    className={`w-full h-full object-cover ${removed ? 'opacity-30 grayscale' : ''}`}
                  />
                  <button
                    type="button"
                    aria-label={`기존 사진 ${i + 1} 삭제`}
                    aria-pressed={removed}
                    onClick={() => toggleRemoved(img.id)}
                    className={thumbButtonClass}
                  >
                    {removed ? '↺' : '×'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {newImages.length > 0 && (
          <div role="group" aria-label="새 사진" className="flex gap-2">
            {newImages.map((img, i) => (
              <div key={img.preview} className={thumbClass}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt={`새 사진 ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  aria-label={`새 사진 ${i + 1} 빼기`}
                  onClick={() => {
                    URL.revokeObjectURL(img.preview);
                    setNewImages(newImages.filter((_, j) => j !== i));
                  }}
                  className={thumbButtonClass}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {shownError && <p role="alert" className="mb-3 text-sm text-red-500 font-medium">{shownError}</p>}

      <label htmlFor="content" className="sr-only">
        내용
      </label>
      {/* 입력 글자 16px 이상: iOS Safari가 초점 시 화면을 확대하지 않게 한다. */}
      <textarea
        id="content"
        name="content"
        required
        rows={8}
        defaultValue={post?.content}
        className="w-full py-1 bg-transparent text-[17px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
        placeholder="오늘 어떤 게임을 하셨나요?"
      />
      <p className="mt-2 text-xs text-muted-foreground">사진은 한 장에 10MB 이하, 최대 {MAX_POST_IMAGES}장까지 올릴 수 있어요.</p>
    </form>
  );
}

'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPost, updatePost, requestPostImageUploads } from '@/app/actions/post';
import { createClient } from '@/utils/supabase/client';
import { checkImageFiles, MAX_POST_IMAGES, POST_PHOTOS_BUCKET } from '@/lib/post-images';
import { addTag, MAX_TAG_LENGTH, MAX_TAGS, TAG_EXAMPLES } from '@/lib/tags';
import { fieldInput, fieldLabel } from '@/lib/form-styles';
import { CameraIcon } from './icons';
import FormHeader from './FormHeader';

type ExistingImage = { id: string; url: string };
type Season = { id: number; name: string };
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
 *
 * 양식은 하나다(설계: 2026-10-17-unified-post-form-design.md §4.1): 사진 + 내용이 기본이고,
 * 태그·모임 날짜·시즌은 선택 입력이다(입력한 경우에만 카드에 보인다). 사진은 모두 회원 전용 버킷에 올라간다.
 */
export default function PostForm({
  mode,
  post,
  seasons = [],
}: {
  mode: 'create' | 'edit';
  post?: { id: string; content: string; images: ExistingImage[]; tags?: string[]; activityDate?: string | null; seasonId?: number | null };
  seasons?: Season[];
}) {
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
        // 토큰을 발급한 버킷(서버와 같은 상수)에 올려야 한다.
        const storage = createClient().storage.from(POST_PHOTOS_BUCKET);
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

      {/* 내용 칸. 예전에는 테두리·배경 없이 화면에 녹아 있어 안내 문구가 일반 설명처럼 보였고, 입력할 수 있는 곳인지 몰랐다.
          그래서 다른 입력란과 같은 회색 상자 + 보이는 라벨로 "여기에 쓴다"를 드러낸다. 플레이스홀더는 예시가 아니라
          무엇을 입력하라는 요청 문구로 둔다(예시 문장은 이미 쓴 글처럼 읽혀 헷갈렸다).
          입력 글자 16px 이상: iOS Safari가 초점 시 화면을 확대하지 않게 한다. */}
      <label htmlFor="content" className={fieldLabel}>
        내용
      </label>
      <textarea
        id="content"
        name="content"
        required
        rows={8}
        defaultValue={post?.content}
        className="w-full min-h-48 px-4 py-3 rounded-xl bg-muted text-[17px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-y"
        placeholder="내용을 입력하세요"
      />
      <p className="mt-2 text-xs text-muted-foreground">사진은 한 장에 10MB 이하, 최대 {MAX_POST_IMAGES}장까지 올릴 수 있어요.</p>

      <TagField initial={post?.tags ?? []} />
      <MeetingFields activityDate={post?.activityDate ?? null} seasonId={post?.seasonId ?? null} seasons={seasons} />
    </form>
  );
}

/**
 * 태그 칸(선택). 입력하고 Enter·쉼표를 누르거나 칸을 벗어나면 #칩으로 추가되고, 예시 칩을 눌러도 추가된다.
 * 칩마다 숨은 입력(name="tags")을 두어 폼 값으로 그대로 전송한다. 규칙(정리·중복·5개)은 서버와 같은 addTag로 맞춘다.
 */
function TagField({ initial }: { initial: string[] }) {
  const [tags, setTags] = useState<string[]>(initial);
  const [text, setText] = useState('');
  const full = tags.length >= MAX_TAGS;
  const commit = (value = text) => {
    setTags((prev) => addTag(prev, value));
    setText('');
  };
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between">
        <label htmlFor="tag-input" className={fieldLabel}>
          태그 <span className="font-normal">(선택)</span>
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">{`${tags.length}/${MAX_TAGS}`}</span>
      </div>
      {tags.map((tag) => (
        <input key={tag} type="hidden" name="tags" value={tag} />
      ))}
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-muted focus-within:ring-2 focus-within:ring-foreground/20">
        {tags.map((tag) => (
          <span key={tag} className="h-8 pl-3 pr-1 inline-flex items-center gap-1 rounded-full bg-background text-[15px] font-medium">
            {`#${tag}`}
            <button
              type="button"
              aria-label={`#${tag} 빼기`}
              onClick={() => setTags(tags.filter((t) => t !== tag))}
              className="w-6 h-6 rounded-full text-muted-foreground hover:bg-muted flex items-center justify-center"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="tag-input"
          value={text}
          disabled={full}
          maxLength={MAX_TAG_LENGTH + 1}
          onChange={(e) => {
            // 쉼표를 치면 그 앞까지를 태그로 넣는다(모바일 키보드에서 Enter보다 쉬움).
            const value = e.target.value;
            if (value.includes(',')) commit(value.replace(/,/g, ''));
            else setText(value);
          }}
          onKeyDown={(e) => {
            // 한글 조합 중 Enter는 조합 확정이라 태그로 넣지 않는다.
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault(); // 폼 제출 대신 태그 추가
              commit();
            } else if (e.key === 'Backspace' && !text && tags.length > 0) {
              setTags(tags.slice(0, -1));
            }
          }}
          onBlur={() => text && commit()}
          placeholder={full ? `태그는 ${MAX_TAGS}개까지예요` : '태그를 입력하세요'}
          className="flex-1 min-w-32 h-8 px-2 bg-transparent text-[17px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">예시</span>
        {TAG_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            disabled={full || tags.includes(example)}
            onClick={() => commit(example)}
            className="h-8 px-3 rounded-full border border-border text-[14px] font-medium text-foreground disabled:opacity-40"
          >
            {`#${example}`}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 모임 날짜·시즌(선택). 비워 두면 저장하지 않고 카드에도 보이지 않는다. 기본값을 두지 않아 "입력한 경우에만"이 지켜진다. */
function MeetingFields({ activityDate, seasonId, seasons }: { activityDate: string | null; seasonId: number | null; seasons: Season[] }) {
  const sorted = [...seasons].sort((a, b) => b.id - a.id);
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      <div>
        <label htmlFor="activityDate" className={fieldLabel}>
          모임 날짜 <span className="font-normal">(선택)</span>
        </label>
        <input id="activityDate" name="activityDate" type="date" defaultValue={activityDate ?? ''} className={fieldInput} />
      </div>
      <div>
        <label htmlFor="seasonId" className={fieldLabel}>
          시즌 <span className="font-normal">(선택)</span>
        </label>
        <select id="seasonId" name="seasonId" defaultValue={seasonId ? String(seasonId) : ''} className={fieldInput}>
          <option value="">선택 안 함</option>
          {sorted.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPost, updatePost, requestPostImageUploads } from '@/app/actions/post';
import { createClient } from '@/utils/supabase/client';
import { bucketForKind, checkImageFiles, MAX_POST_IMAGES, type PostKind } from '@/lib/post-images';
import { ACTIVITY_TYPE_EXAMPLES, MAX_ACTIVITY_TYPE_LENGTH, getActivityType } from '@/lib/activity-types';
import { fieldInput, fieldLabel } from '@/lib/form-styles';
import { CameraIcon } from './icons';
import FormHeader from './FormHeader';

type ExistingImage = { id: string; url: string };
type ActivityValues = { title: string; activityType: string; activityDate: string; seasonId: number };
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
 * 글 종류(설계 §5.3): 작성 화면에서만 "일반 글 | 활동 기록"을 고른다. 종류에 따라 사진 버킷이 달라서
 * (활동 기록은 회원 전용 activity_photos) 수정 화면에서는 바꿀 수 없다. 활동 기록이면 제목·종류·모임 날짜·시즌을 더 받는다.
 * 모임 날짜 기본값(today)은 서버가 한국 날짜로 계산해 넘긴다(브라우저 계산은 hydration 불일치·시간대 문제).
 */
export default function PostForm({
  mode,
  post,
  seasons = [],
  today = '',
}: {
  mode: 'create' | 'edit';
  post?: { id: string; content: string; images: ExistingImage[]; kind?: PostKind; activity?: ActivityValues | null };
  seasons?: Season[];
  today?: string;
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
  const [kind, setKind] = useState<PostKind>(post?.kind ?? 'general');
  const isActivity = kind === 'activity';

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
        const issued = await requestPostImageUploads(files.map((f) => ({ type: f.type, size: f.size })), keptCount, kind);
        if ('error' in issued) {
          setError(issued.error);
          return;
        }
        // 토큰을 발급한 버킷과 같은 버킷에 올려야 한다(서버와 같은 규칙 bucketForKind).
        const storage = createClient().storage.from(bucketForKind(kind));
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
        title={mode === 'create' ? '새 게시글' : isActivity ? '활동 기록 수정' : '게시글 수정'}
        cancelHref="/"
        submitLabel={mode === 'create' ? '게시하기' : '수정완료'}
        busy={busy}
        busyLabel={uploading ? '사진 올리는 중…' : undefined}
      />

      {mode === 'create' && <KindSwitch kind={kind} onChange={setKind} />}
      {isActivity && <ActivityFields values={post?.activity ?? null} seasons={seasons} today={today} />}

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
        className="w-full min-h-48 px-4 py-3 rounded-xl bg-muted text-[16px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-y"
        placeholder={isActivity ? '활동 내용과 후기를 입력하세요' : '내용을 입력하세요'}
      />
      <p className="mt-2 text-xs text-muted-foreground">사진은 한 장에 10MB 이하, 최대 {MAX_POST_IMAGES}장까지 올릴 수 있어요.</p>
    </form>
  );
}

/**
 * 글 종류 고르기(작성 화면 전용). 라디오 그룹이라 폼 값 kind로 그대로 전송된다.
 * 두 칸짜리 분할 버튼 모양이지만 실제 입력은 라디오라 키보드(←/→)·스크린리더가 기본으로 동작한다.
 */
function KindSwitch({ kind, onChange }: { kind: PostKind; onChange: (kind: PostKind) => void }) {
  const options: { value: PostKind; label: string }[] = [
    { value: 'general', label: '일반 글' },
    { value: 'activity', label: '활동 기록' },
  ];
  return (
    <div role="radiogroup" aria-label="글 종류" className="mb-4 grid grid-cols-2 p-1 rounded-xl bg-muted">
      {options.map((o) => (
        <label
          key={o.value}
          className="h-10 rounded-lg flex items-center justify-center text-[15px] font-semibold text-muted-foreground cursor-pointer has-[:checked]:bg-background has-[:checked]:text-foreground has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-foreground/30"
        >
          <input
            type="radio"
            name="kind"
            value={o.value}
            checked={kind === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/**
 * 활동 기록 칸: 제목(필수) · 종류(글자 입력, 필수) · 모임 날짜 · 시즌(기본 최신).
 * 종류는 정해진 목록이 아니라 회원이 입력한다. 무엇을 쓰면 되는지 알 수 있게 예시 칩을 두고, 누르면 입력란에 채운다.
 * 서버(parseActivityFields)가 다시 검사하므로 여기서는 required로 빠뜨림만 막는다.
 */
function ActivityFields({ values, seasons, today }: { values: ActivityValues | null; seasons: Season[]; today: string }) {
  const latest = seasons.reduce<Season | null>((a, b) => (a && a.id > b.id ? a : b), null);
  const sorted = [...seasons].sort((a, b) => b.id - a.id);
  // 예시 칩으로 값을 채워야 해서 제어 입력으로 둔다. 예전 코드(ESCAPE_ROOM 등)는 이름으로 바꿔 보여준다.
  const [type, setType] = useState(values ? getActivityType(values.activityType).label : '');
  return (
    <div className="mb-4 space-y-4">
      <div>
        <label htmlFor="title" className={fieldLabel}>
          제목
        </label>
        <input id="title" name="title" required maxLength={100} defaultValue={values?.title} className={fieldInput} placeholder="제목을 입력하세요" />
      </div>

      <div>
        <label htmlFor="activityType" className={fieldLabel}>
          활동 종류
        </label>
        <input
          id="activityType"
          name="activityType"
          required
          maxLength={MAX_ACTIVITY_TYPE_LENGTH}
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={fieldInput}
          placeholder="활동 종류를 입력하세요"
          aria-describedby="activityType-examples"
        />
        <div id="activityType-examples" className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">예시</span>
          {ACTIVITY_TYPE_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              aria-pressed={type === example}
              onClick={() => setType(example)}
              className="h-8 px-3 rounded-full border border-border text-[13px] font-medium text-foreground aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:border-foreground"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="activityDate" className={fieldLabel}>
            모임 날짜
          </label>
          <input id="activityDate" name="activityDate" type="date" required defaultValue={values?.activityDate ?? today} className={fieldInput} />
        </div>
        <div>
          <label htmlFor="seasonId" className={fieldLabel}>
            시즌
          </label>
          <select id="seasonId" name="seasonId" required defaultValue={String(values?.seasonId ?? latest?.id ?? '')} className={fieldInput}>
            {sorted.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// 게시글·프로필 사진 업로드 규칙. 브라우저(미리 검사)와 서버 액션(최종 검사)이 같은 규칙을 쓰도록 한곳에 둔다.
export const MAX_POST_IMAGES = 10;
export const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;
export const TOO_MANY_IMAGES = `사진은 최대 ${MAX_POST_IMAGES}장까지 올릴 수 있습니다.`;
export const IMAGE_TOO_LARGE = '사진은 한 장에 10MB 이하여야 합니다.';
export const NOT_AN_IMAGE = '이미지 파일만 올릴 수 있습니다.';

/**
 * 이미지 형식인지. SVG는 스크립트를 담을 수 있고 공개 버킷 주소를 직접 열면 실행되므로 이미지로 치지 않는다.
 */
export const isAllowedImageType = (type: string) => type.startsWith('image/') && type !== 'image/svg+xml';

/**
 * 사진 목록이 규칙을 지키는지 검사하고, 어기면 사용자에게 보여줄 문구를, 지키면 null을 돌려준다.
 * existing은 수정 화면에서 남겨 둔 기존 사진 수다(기존 + 새 사진 ≤ 10).
 */
export function checkImageFiles(files: { type: string; size: number }[], existing = 0): string | null {
  if (existing + files.length > MAX_POST_IMAGES) return TOO_MANY_IMAGES;
  if (files.some((f) => !isAllowedImageType(f.type))) return NOT_AN_IMAGE;
  if (files.some((f) => f.size > MAX_POST_IMAGE_BYTES)) return IMAGE_TOO_LARGE;
  return null;
}

/**
 * 저장 경로의 확장자를 MIME 형식으로 정한다. 사용자가 정한 파일 이름을 경로에 쓰지 않아
 * 경로 조작(../)이나 이상한 문자가 들어갈 여지를 없앤다. 알 수 없는 형식은 img.
 */
export function extensionFor(type: string): string {
  if (type === 'image/jpeg') return 'jpg';
  const sub = type.startsWith('image/') ? type.slice('image/'.length) : '';
  return /^[a-z0-9]{1,10}$/.test(sub) ? sub : 'img';
}

/** 공개 버킷(post_images)의 경로를 공개 URL로 바꾼다. DB에는 경로만 저장한다(설계 §3.2). */
export function postImagePublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post_images/${path}`;
}

/**
 * 게시글 사진 버킷. 자유글은 post_images(공개), 활동 기록은 activity_photos(비공개, 회원에게만 signed URL)다(설계 §3.1).
 * 한 글의 사진은 모두 같은 공개 범위여야 하므로 행마다 버킷을 저장하지 않고 게시글 종류로 정한다.
 * 그래서 작성 후에는 종류를 바꾸지 않는다(바꾸면 사진이 엉뚱한 버킷을 가리킨다).
 */
export type PostImageBucket = 'post_images' | 'activity_photos';
export type PostKind = 'general' | 'activity';

export function bucketForKind(kind: string): PostImageBucket {
  return kind === 'activity' ? 'activity_photos' : 'post_images';
}

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

/**
 * 게시글 사진 버킷. 모든 글의 사진은 회원 전용이라 비공개 버킷에 두고, 회원에게만 signed URL로 보여준다
 * (설계: 2026-10-17-unified-post-form-design.md §3.3). 이름이 activity_photos인 것은 이관한 활동 사진 197장을
 * 옮기지 않으려고 기존 버킷을 그대로 쓰기 때문이다. 코드에서는 이 상수로만 가리킨다.
 * 브라우저(서명 토큰으로 업로드)와 서버(토큰 발급·검사·삭제)가 같은 버킷을 써야 해서 클라이언트에서도 읽는 이 파일에 둔다.
 */
export const POST_PHOTOS_BUCKET = 'activity_photos';

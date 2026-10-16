import { describe, it, expect } from 'vitest';
import {
  checkImageFiles, extensionFor, postImagePublicUrl,
  MAX_POST_IMAGES, MAX_POST_IMAGE_BYTES, TOO_MANY_IMAGES, IMAGE_TOO_LARGE, NOT_AN_IMAGE,
} from './post-images';

const png = (size = 100) => ({ type: 'image/png', size });

describe('checkImageFiles', () => {
  it('규칙 값: 최대 10장, 장당 10MB', () => {
    expect(MAX_POST_IMAGES).toBe(10);
    expect(MAX_POST_IMAGE_BYTES).toBe(10 * 1024 * 1024);
  });

  it('통과하면 null', () => {
    expect(checkImageFiles([png(), { type: 'image/jpeg', size: MAX_POST_IMAGE_BYTES }])).toBeNull();
    expect(checkImageFiles([])).toBeNull();
  });

  it('기존 사진 수를 더해 10장을 넘으면 거부', () => {
    expect(checkImageFiles(Array.from({ length: 11 }, () => png()))).toBe(TOO_MANY_IMAGES);
    expect(checkImageFiles([png(), png()], 9)).toBe(TOO_MANY_IMAGES);
    expect(checkImageFiles([png()], 9)).toBeNull();
  });

  it('10MB 초과, 이미지가 아닌 형식은 거부', () => {
    expect(checkImageFiles([png(MAX_POST_IMAGE_BYTES + 1)])).toBe(IMAGE_TOO_LARGE);
    expect(checkImageFiles([{ type: 'application/pdf', size: 10 }])).toBe(NOT_AN_IMAGE);
    expect(checkImageFiles([{ type: '', size: 10 }])).toBe(NOT_AN_IMAGE);
    // SVG는 스크립트를 담을 수 있어(주소를 직접 열면 실행됨) 받지 않는다.
    expect(checkImageFiles([{ type: 'image/svg+xml', size: 10 }])).toBe(NOT_AN_IMAGE);
  });

  it('문구', () => {
    expect(TOO_MANY_IMAGES).toBe('사진은 최대 10장까지 올릴 수 있습니다.');
    expect(IMAGE_TOO_LARGE).toBe('사진은 한 장에 10MB 이하여야 합니다.');
    expect(NOT_AN_IMAGE).toBe('이미지 파일만 올릴 수 있습니다.');
  });
});

describe('extensionFor', () => {
  it('MIME 형식에서 확장자를 정한다(파일 이름은 사용자가 정하므로 믿지 않음)', () => {
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/heic')).toBe('heic');
    expect(extensionFor('image/../../x')).toBe('img');
  });
});

describe('postImagePublicUrl', () => {
  it('공개 버킷 경로를 공개 URL로 바꾼다', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    expect(postImagePublicUrl('u1/a.png')).toBe('https://example.supabase.co/storage/v1/object/public/post_images/u1/a.png');
  });
});

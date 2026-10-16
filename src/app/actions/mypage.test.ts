import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { updateProfile } from './mypage';
import * as session from '@/lib/session';

vi.mock('@/db', () => ({
  db: {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn(),
  },
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/storage-admin', () => ({
  uploadAvatar: vi.fn().mockResolvedValue('https://public/avatars/1/new.png'),
}));

const me = { userId: '1', username: 'test', isAdmin: false, mustChangePin: false, expiresAt: new Date() };
const fields = (f: Record<string, string | File>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.append(k, v);
  return fd;
};
const mockDbWrite = async (result: Promise<unknown> | unknown = undefined) => {
  const { db } = await import('@/db');
  const mockDb = db as unknown as Record<'update' | 'set' | 'where', Mock>;
  mockDb.where.mockReturnValueOnce(result);
  return mockDb;
};

describe('mypage server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateProfile', () => {
    it('returns error if not logged in', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(null);
      const formData = new FormData();
      const result = await updateProfile(null, formData);
      expect(result).toEqual({ error: '로그인이 필요합니다.' });
    });

    it('returns error if new PINs do not match', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: '1', username: 'test', isAdmin: false, mustChangePin: false, expiresAt: new Date() });
      const formData = new FormData();
      formData.append('newPin', '1234');
      formData.append('confirmNewPin', '4321');
      const result = await updateProfile(null, formData);
      expect(result).toEqual({ error: '새 비밀번호가 일치하지 않습니다.' });
    });

    it('returns error if new PIN is invalid format', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: '1', username: 'test', isAdmin: false, mustChangePin: false, expiresAt: new Date() });
      const formData = new FormData();
      formData.append('newPin', '123');
      formData.append('confirmNewPin', '123');
      const result = await updateProfile(null, formData);
      expect(result).toEqual({ error: '비밀번호는 4자리 숫자여야 합니다.' });
    });
  
    it('마이페이지에서도 초기 PIN(1234)으로는 변경 불가', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: '1', username: 'test', isAdmin: false, mustChangePin: false, expiresAt: new Date() });
      const formData = new FormData();
      formData.append('newPin', '1234');
      formData.append('confirmNewPin', '1234');
      expect(await updateProfile(null, formData)).toEqual({ error: '초기 비밀번호(1234)는 사용할 수 없습니다.' });
    });

    it('PIN을 바꾸면 mustChangePin=false로 저장하고 세션 재발급(관리자 여부는 DB 값)', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: '1', username: 'test', isAdmin: false, mustChangePin: true, expiresAt: new Date() });
      const { db } = await import('@/db');
      const mockDb = db as unknown as Record<'update' | 'set' | 'where', Mock>;
      mockDb.where.mockReturnValueOnce({ returning: vi.fn().mockResolvedValue([{ isAdmin: true }]) });
      const formData = new FormData();
      formData.append('newPin', '5678');
      formData.append('confirmNewPin', '5678');

      expect(await updateProfile(null, formData)).toEqual({ success: '정보가 성공적으로 수정되었습니다.' });
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ mustChangePin: false, pinHash: expect.any(String) }));
      expect(session.createSession).toHaveBeenCalledWith('1', 'test', { isAdmin: true, mustChangePin: false });
    });

    it('닉네임은 앞뒤 공백을 지워 저장한다', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(me);
      const mockDb = await mockDbWrite();
      expect(await updateProfile(null, fields({ nickname: '  보드왕 ', department: '개발팀', bio: '' })))
        .toEqual({ success: '정보가 성공적으로 수정되었습니다.' });
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ nickname: '보드왕', department: '개발팀' }));
    });

    it('닉네임 길이 위반은 저장하지 않고 오류', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(me);
      const { db } = await import('@/db');
      expect(await updateProfile(null, fields({ nickname: '가' }))).toEqual({ error: '닉네임은 2~20자로 입력해주세요.' });
      expect(db.update).not.toHaveBeenCalled();
    });

    it('다른 회원이 (대소문자 무시) 쓰는 닉네임이면 DB 고유 인덱스 위반을 문구로 바꾼다', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(me);
      await mockDbWrite(Promise.reject(Object.assign(new Error('Failed query'), { cause: { code: '23505' } })));
      expect(await updateProfile(null, fields({ nickname: 'Taken' }))).toEqual({ error: '이미 사용 중인 닉네임입니다.' });
    });

    it('프로필 사진은 서비스 키 업로드(uploadAvatar)로 회원 폴더에 Buffer로 올리고 공개 URL을 저장한다', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(me);
      const mockDb = await mockDbWrite();
      const { uploadAvatar } = await import('@/lib/storage-admin');
      const image = new File([new Uint8Array([1, 2, 3])], 'my photo.PNG', { type: 'image/png' });
      expect(await updateProfile(null, fields({ nickname: '보드왕', profileImage: image })))
        .toEqual({ success: '정보가 성공적으로 수정되었습니다.' });
      expect(uploadAvatar).toHaveBeenCalledWith(expect.stringMatching(/^1\/[0-9a-f-]{36}\.png$/), expect.any(Buffer), 'image/png');
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ profileImageUrl: 'https://public/avatars/1/new.png' }));
    });

    it('프로필 사진도 이미지 형식·10MB 규칙을 서버에서 검사한다', async () => {
      const { uploadAvatar } = await import('@/lib/storage-admin');
      vi.mocked(session.getSession).mockResolvedValueOnce(me);
      const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' });
      expect(await updateProfile(null, fields({ nickname: '보드왕', profileImage: pdf }))).toEqual({ error: '이미지 파일만 올릴 수 있습니다.' });
      vi.mocked(session.getSession).mockResolvedValueOnce(me);
      const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
      expect(await updateProfile(null, fields({ nickname: '보드왕', profileImage: big }))).toEqual({ error: '사진은 한 장에 10MB 이하여야 합니다.' });
      expect(uploadAvatar).not.toHaveBeenCalled();
    });

    it('사진 삭제(removeProfileImage=1)면 profileImageUrl을 null로 되돌린다(사진을 설정하지 않은 상태)', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(me);
      const mockDb = await mockDbWrite();
      const { uploadAvatar } = await import('@/lib/storage-admin');
      expect(await updateProfile(null, fields({ nickname: '보드왕', removeProfileImage: '1' })))
        .toEqual({ success: '정보가 성공적으로 수정되었습니다.' });
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ profileImageUrl: null }));
      expect(uploadAvatar).not.toHaveBeenCalled();
    });

    it('사진 삭제 표시가 없으면 기존 사진을 건드리지 않는다', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(me);
      const mockDb = await mockDbWrite();
      await updateProfile(null, fields({ nickname: '보드왕' }));
      expect(mockDb.set.mock.calls[0][0]).not.toHaveProperty('profileImageUrl');
    });

    it('프로필 사진 업로드가 실패하면 저장하지 않고 오류', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(me);
      const { uploadAvatar } = await import('@/lib/storage-admin');
      vi.mocked(uploadAvatar).mockRejectedValueOnce(new Error('denied'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { db } = await import('@/db');
      const image = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
      expect(await updateProfile(null, fields({ nickname: '보드왕', profileImage: image }))).toEqual({ error: '프로필 사진 업로드에 실패했습니다.' });
      expect(db.update).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});

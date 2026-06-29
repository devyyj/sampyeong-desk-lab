import { signUpUser, signInUser, signOutUser } from './auth';
import { createClient } from '@/utils/supabase/client';

jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(),
}));

describe('Auth Helpers', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
      },
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signUpUser', () => {
    it('이름이나 부서 누락 시 에러를 던져야 한다 (TC-01-01)', async () => {
      await expect(
        signUpUser({
          nickname: 'test',
          realName: '',
          department: '개발팀',
          password4Digit: '1234',
        })
      ).rejects.toThrow('이름과 부서는 필수 입력 항목입니다.');

      await expect(
        signUpUser({
          nickname: 'test',
          realName: '홍길동',
          department: '',
          password4Digit: '1234',
        })
      ).rejects.toThrow('이름과 부서는 필수 입력 항목입니다.');
    });

    it('비밀번호가 4자리 숫자가 아니면 에러를 던져야 한다', async () => {
      await expect(
        signUpUser({
          nickname: 'test',
          realName: '홍길동',
          department: '개발팀',
          password4Digit: '123',
        })
      ).rejects.toThrow('비밀번호는 숫자 4자리여야 합니다.');
    });

    it('중복 닉네임 가입 시도 시 에러를 던져야 한다 (TC-01-02)', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { nickname: 'already_taken' },
        error: null,
      });

      await expect(
        signUpUser({
          nickname: 'already_taken',
          realName: '김철수',
          department: '개발팀',
          password4Digit: '1111',
        })
      ).rejects.toThrow('이미 사용 중인 닉네임입니다.');
    });

    it('성공적으로 회원가입을 수행해야 한다 (TC-01-04)', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'new-uuid' } },
        error: null,
      });

      const res = await signUpUser({
        nickname: 'newuser',
        realName: '이영희',
        department: '디자인팀',
        password4Digit: '4321',
      });

      expect(res.user?.id).toBe('new-uuid');
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@sdl.com',
        password: 'hashed_4321_salt',
        options: {
          data: {
            nickname: 'newuser',
            real_name: '이영희',
            department: '디자인팀',
            role: 'user',
          },
        },
      });
    });
  });

  describe('signInUser', () => {
    it('인증 실패 시 올바른 에러를 던져야 한다 (TC-02-01)', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid login credentials'),
      });

      await expect(signInUser('nobody', '9999')).rejects.toThrow(
        '닉네임 또는 비밀번호가 일치하지 않습니다.'
      );
    });

    it('성공적으로 로그인을 수행해야 한다 (TC-02-02)', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-uuid' } },
        error: null,
      });

      const res = await signInUser('testuser', '1234');
      expect(res.user?.id).toBe('user-uuid');
    });
  });
});

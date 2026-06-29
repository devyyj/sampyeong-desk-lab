import { signUpUser, signInUser, signOutUser } from './auth';
import { createClient } from '@/utils/supabase/client';

jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(),
}));

describe('Extra Auth Logic and Route Mocking Tests', () => {
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

  it('회원 가입 성공 시 올바른 닉네임과 정보를 전달해야 한다', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    const res = await signUpUser({
      nickname: 'user1',
      realName: '홍길동',
      department: '연구개발부',
      password4Digit: '9876',
    });

    expect(res.user?.id).toBe('test-user-id');
    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'user1@sdl.com',
      password: 'hashed_9876_salt',
      options: {
        data: {
          nickname: 'user1',
          real_name: '홍길동',
          department: '연구개발부',
          role: 'user',
        },
      },
    });
  });
});

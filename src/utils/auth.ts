import { createClient } from '@/utils/supabase/client';

export interface UserSignUpData {
  nickname: string;
  realName: string;
  department: string;
  password4Digit: string;
}

export async function signUpUser({ nickname, realName, department, password4Digit }: UserSignUpData) {
  if (!realName || !department) {
    throw new Error('이름과 부서는 필수 입력 항목입니다.');
  }
  if (!/^\d{4}$/.test(password4Digit)) {
    throw new Error('비밀번호는 숫자 4자리여야 합니다.');
  }

  const supabase = createClient();
  
  // Check nickname unique
  const { data: existingProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('nickname', nickname)
    .maybeSingle();

  if (profileErr) {
    throw new Error(`닉네임 중복 검사 실패: ${profileErr.message}`);
  }

  if (existingProfile) {
    throw new Error('이미 사용 중인 닉네임입니다.');
  }

  // Use nickname@sdl.com as email, and password4Digit as base password
  const email = `${nickname}@sdl.com`;
  const password = `hashed_${password4Digit}_salt`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname,
        real_name: realName,
        department,
        role: 'user',
      }
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function signInUser(nickname: string, password4Digit: string) {
  if (!nickname || !password4Digit) {
    throw new Error('닉네임과 비밀번호를 입력해주세요.');
  }
  
  const supabase = createClient();
  const email = `${nickname}@sdl.com`;
  const password = `hashed_${password4Digit}_salt`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // translate error or default message
    throw new Error('닉네임 또는 비밀번호가 일치하지 않습니다.');
  }

  return data;
}

export async function signOutUser() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

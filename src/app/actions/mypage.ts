'use server';

import { db } from '@/db';
import { users } from '../../../drizzle/schema';
import { createSession, getSession } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { hashPIN } from '@/lib/auth-utils';
import { createClient } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

export async function updateProfile(prevState: any, formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { error: '로그인이 필요합니다.' };
  }

  const department = formData.get('department') as string;
  const bio = formData.get('bio') as string;
  const newPin = formData.get('newPin') as string;
  const confirmNewPin = formData.get('confirmNewPin') as string;
  const image = formData.get('profileImage') as File | null;

  try {
    const updateData: any = { department, bio };

    if (newPin) {
      if (newPin !== confirmNewPin) {
        return { error: '새 비밀번호가 일치하지 않습니다.' };
      }
      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        return { error: '비밀번호는 4자리 숫자여야 합니다.' };
      }
      updateData.pinHash = await hashPIN(newPin);
      // 본인이 PIN을 바꿨으므로 "관리자가 준 PIN 사용 중" 상태가 아니다.
      updateData.mustChangePin = false;
    }

    if (image && image.size > 0) {
      const supabase = await createClient();
      const fileExt = image.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${session.userId}/${fileName}`;
      
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, buffer, { contentType: image.type });

      if (uploadError) {
        console.error('Upload error', uploadError);
        return { error: '프로필 사진 업로드에 실패했습니다.' };
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      updateData.profileImageUrl = publicUrlData.publicUrl;
    }

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, session.userId))
      .returning({ isAdmin: users.isAdmin });
    if (newPin) {
      // 세션의 mustChangePin도 함께 갱신해야 middleware가 PIN 변경 화면으로 다시 보내지 않는다.
      // 관리자 여부는 세션이 아닌 DB 값으로 다시 담는다.
      await createSession(session.userId, session.username, { isAdmin: updated?.isAdmin ?? false, mustChangePin: false });
    }
    
    revalidatePath('/mypage');
    revalidatePath('/members');
    return { success: '정보가 성공적으로 수정되었습니다.' };
  } catch (e) {
    console.error('Update profile error', e);
    return { error: '정보 수정 중 오류가 발생했습니다.' };
  }
}

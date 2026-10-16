'use server';

import { db } from '@/db';
import { users } from '../../../drizzle/schema';
import { createSession, getSession } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { hashPIN, INITIAL_PIN, INITIAL_PIN_REJECTED } from '@/lib/auth-utils';
import { uploadAvatar } from '@/lib/storage-admin';
import { checkImageFiles, extensionFor } from '@/lib/post-images';
import { NICKNAME_TAKEN, validateNickname } from '@/lib/nickname';
import { isUniqueViolation } from '@/lib/pg-errors';
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

  const nicknameField = formData.get('nickname');

  try {
    const updateData: any = { department, bio };

    // 폼은 항상 닉네임을 보내지만, 필드가 없는 호출(다른 항목만 바꾸는 경우)은 닉네임을 건드리지 않는다.
    if (nicknameField !== null) {
      const checked = validateNickname(String(nicknameField));
      if (!checked.ok) return { error: checked.error };
      updateData.nickname = checked.nickname;
    }

    if (newPin) {
      if (newPin !== confirmNewPin) {
        return { error: '새 비밀번호가 일치하지 않습니다.' };
      }
      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        return { error: '비밀번호는 4자리 숫자여야 합니다.' };
      }
      // 마이페이지에서 공개된 초기 PIN으로 되돌리면 PIN 변경 강제를 우회하게 되므로 막는다.
      if (newPin === INITIAL_PIN) {
        return { error: INITIAL_PIN_REJECTED };
      }
      updateData.pinHash = await hashPIN(newPin);
      // 본인이 PIN을 바꿨으므로 "관리자가 준 PIN 사용 중" 상태가 아니다.
      updateData.mustChangePin = false;
    }

    if (image && image.size > 0) {
      // 브라우저 검사를 우회한 직접 호출도 있으므로 게시글 사진과 같은 규칙을 서버에서 다시 검사한다.
      const invalid = checkImageFiles([image]);
      if (invalid) return { error: invalid };

      // 0005에서 익명 업로드 정책을 지웠으므로 서비스 키(uploadAvatar)로 올린다.
      // 경로의 확장자는 사용자가 정한 파일 이름이 아니라 MIME 형식으로 정한다.
      const filePath = `${session.userId}/${uuidv4()}.${extensionFor(image.type)}`;
      try {
        updateData.profileImageUrl = await uploadAvatar(filePath, Buffer.from(await image.arrayBuffer()), image.type);
      } catch (e) {
        console.error('Upload error', e);
        return { error: '프로필 사진 업로드에 실패했습니다.' };
      }
    }

    const updateQuery = db.update(users).set(updateData).where(eq(users.id, session.userId));
    if (newPin) {
      const [updated] = await updateQuery.returning({ isAdmin: users.isAdmin });
      // 세션의 mustChangePin도 함께 갱신해야 middleware가 PIN 변경 화면으로 다시 보내지 않는다.
      // 관리자 여부는 세션이 아닌 DB 값으로 다시 담는다.
      await createSession(session.userId, session.username, { isAdmin: updated?.isAdmin ?? false, mustChangePin: false });
    } else {
      await updateQuery;
    }

    // 닉네임은 피드·댓글 작성자 표시에 쓰이므로 그 화면들도 새로 그린다.
    revalidatePath('/');
    revalidatePath('/posts/[id]', 'page');
    revalidatePath('/mypage');
    revalidatePath('/members');
    return { success: '정보가 성공적으로 수정되었습니다.' };
  } catch (e) {
    // 다른 회원이 (대소문자 무시) 같은 닉네임을 쓰면 lower(nickname) 고유 인덱스가 막는다(동시 변경 포함).
    if (isUniqueViolation(e)) return { error: NICKNAME_TAKEN };
    console.error('Update profile error', e);
    return { error: '정보 수정 중 오류가 발생했습니다.' };
  }
}

'use server';

import { db } from '@/db';
import { posts } from '../../../drizzle/schema';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export async function createPost(prevState: any, formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { error: '로그인이 필요합니다.' };
  }

  const content = formData.get('content') as string;
  const image = formData.get('image') as File | null;

  if (!content) {
    return { error: '내용을 입력해주세요.' };
  }

  let imageUrl = null;

  try {
    if (image && image.size > 0) {
      const supabase = await createClient();
      const fileExt = image.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${session.userId}/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('post_images')
        .upload(filePath, image);

      if (uploadError) {
        console.error('Upload error', uploadError);
        return { error: '이미지 업로드에 실패했습니다.' };
      }

      const { data: publicUrlData } = supabase.storage
        .from('post_images')
        .getPublicUrl(filePath);

      imageUrl = publicUrlData.publicUrl;
    }

    await db.insert(posts).values({
      content,
      imageUrl,
      authorId: session.userId,
    });
  } catch (e) {
    console.error('Create post error', e);
    return { error: '게시글 작성 중 오류가 발생했습니다.' };
  }

  redirect('/');
}

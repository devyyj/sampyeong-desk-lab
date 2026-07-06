'use server';

import { db } from '@/db';
import { boardGames } from '../../../drizzle/schema';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export async function addBoardGame(prevState: any, formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { error: '로그인이 필요합니다.' };
  }

  const name = formData.get('name') as string;
  const recommendedPlayers = formData.get('recommendedPlayers') as string;
  const playTime = formData.get('playTime') as string;
  const image = formData.get('image') as File | null;

  if (!name) {
    return { error: '보드게임 이름을 입력해주세요.' };
  }

  let thumbnailUrl = null;

  try {
    if (image && image.size > 0) {
      const supabase = await createClient();
      const fileExt = image.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${session.userId}/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('boardgame_thumbnails')
        .upload(filePath, image);

      if (uploadError) {
        console.error('Upload error', uploadError);
        return { error: '이미지 업로드에 실패했습니다.' };
      }

      const { data: publicUrlData } = supabase.storage
        .from('boardgame_thumbnails')
        .getPublicUrl(filePath);

      thumbnailUrl = publicUrlData.publicUrl;
    }

    await db.insert(boardGames).values({
      name,
      recommendedPlayers,
      playTime,
      thumbnailUrl,
      addedById: session.userId,
    });
  } catch (e) {
    console.error('Add boardgame error', e);
    return { error: '보드게임 등록 중 오류가 발생했습니다.' };
  }

  revalidatePath('/boardgames');
  redirect('/boardgames');
}

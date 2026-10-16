'use server';

import { db } from '@/db';
import { boardGames } from '../../../drizzle/schema';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

/**
 * 공용 보관함 체크박스 값. 체크박스는 꺼져 있으면 FormData에 키 자체가 없으므로 "있으면 true"로 읽는다.
 * 보드게임은 보관 상태(보관 중·플레이 중·대여 중) 대신 공용 보관함에 있는지만 관리한다.
 * board_games.status 컬럼은 이관 데이터 호환을 위해 남겨 두되 더 이상 읽거나 쓰지 않는다(기본값 AVAILABLE).
 */
function readCabinet(formData: FormData): boolean {
  return formData.get('inSharedCabinet') !== null;
}

const CATEGORY_MAX = 50; // board_games.category varchar(50)
const CATEGORY_TOO_LONG = '카테고리는 50자 이하로 입력해주세요.';

/**
 * 카테고리 입력값. 앞뒤 공백을 지우고 연속 공백을 하나로 줄인다(" 트릭  테이킹"과 "트릭 테이킹"이 다른 필터로 갈라지지 않게 —
 * 0004에서 표기 차이로 갈라진 분류를 한 번 정리한 적이 있다). 비우면 미분류(null).
 * 형식에 맞지 않으면 { error }를 돌려준다.
 */
function readCategory(formData: FormData): { category: string | null } | { error: string } {
  const raw = formData.get('category');
  const category = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (category.length > CATEGORY_MAX) return { error: CATEGORY_TOO_LONG };
  return { category: category || null };
}

export async function addBoardGame(prevState: any, formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { error: '로그인이 필요합니다.' };
  }

  const name = formData.get('name') as string;
  const recommendedPlayers = formData.get('recommendedPlayers') as string;
  const playTime = formData.get('playTime') as string;

  if (!name) {
    return { error: '보드게임 이름을 입력해주세요.' };
  }
  const category = readCategory(formData);
  if ('error' in category) return category;

  // 보드게임 목록은 이미지 없이 정보만 보여주므로 썸네일은 더 이상 받지 않는다.
  // (폼에서 파일 입력을 뺐고, 요청에 파일이 섞여 와도 Storage에 올리지 않는다. 기존 thumbnail_url 데이터는 그대로 둔다.)
  try {
    await db.insert(boardGames).values({
      name,
      category: category.category,
      recommendedPlayers,
      playTime,
      inSharedCabinet: readCabinet(formData),
      addedById: session.userId,
    });
  } catch (e) {
    console.error('Add boardgame error', e);
    return { error: '보드게임 등록 중 오류가 발생했습니다.' };
  }

  revalidatePath('/boardgames');
  redirect('/boardgames');
}

export async function updateBoardGame(prevState: any, formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { error: '로그인이 필요합니다.' };
  }

  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const recommendedPlayers = formData.get('recommendedPlayers') as string;
  const playTime = formData.get('playTime') as string;

  if (!id || !name) {
    return { error: '필수 값을 입력해주세요.' };
  }
  const category = readCategory(formData);
  if ('error' in category) return category;

  try {
    await db.update(boardGames)
      .set({ name, category: category.category, recommendedPlayers, playTime, inSharedCabinet: readCabinet(formData), updatedAt: new Date() })
      .where(eq(boardGames.id, id));
  } catch (e) {
    console.error('Update boardgame error', e);
    return { error: '보드게임 수정 중 오류가 발생했습니다.' };
  }

  revalidatePath('/boardgames');
  redirect('/boardgames');
}

export async function deleteBoardGame(id: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('로그인이 필요합니다.');
  }

  try {
    await db.delete(boardGames).where(eq(boardGames.id, id));
    revalidatePath('/boardgames');
  } catch (e) {
    console.error('Delete boardgame error', e);
    throw new Error('보드게임 삭제 중 오류가 발생했습니다.');
  }
}

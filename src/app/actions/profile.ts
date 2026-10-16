'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '../../../drizzle/schema';
import { getSession } from '@/lib/session';
import { getMemberBadges, type MemberBadge } from '@/lib/member-badges';
import { isUuid } from '@/lib/uuid';

export type ProfileView = {
  nickname: string;
  profileImageUrl: string | null;
  bio: string | null;
  badge: MemberBadge | null;
  // 회원이 볼 때만 들어간다. 비회원 응답에는 키 자체가 없다.
  displayName?: string | null;
  department?: string;
};

/**
 * 닉네임을 눌렀을 때 띄우는 프로필 팝업의 내용.
 * 실명·부서는 회원 전용 정보라, 페이지 HTML에 미리 싣지 않고 팝업을 열 때 이 액션으로 받아 온다.
 * 이 액션은 누구나 직접 호출할 수 있으므로 회원 여부를 여기서 세션으로 다시 판단한다.
 * 아이디(로그인용)와 PIN 해시 등은 어떤 경우에도 돌려주지 않는다.
 */
export async function getProfile(userId: string): Promise<ProfileView | null> {
  if (!isUuid(userId)) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;

  const [session, badges] = await Promise.all([getSession(), getMemberBadges([user.id])]);
  const profile: ProfileView = {
    nickname: user.nickname,
    profileImageUrl: user.profileImageUrl,
    bio: user.bio,
    badge: badges.get(user.id) ?? null,
  };
  if (session) {
    profile.displayName = user.displayName;
    profile.department = user.department;
  }
  return profile;
}

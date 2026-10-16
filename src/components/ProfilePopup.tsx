'use client';

import { useEffect, useState } from 'react';
import { getProfile, type ProfileView } from '@/app/actions/profile';
import { badgeLabel } from '@/lib/badge';
import BottomSheet from './BottomSheet';
import Avatar from './Avatar';

/**
 * 닉네임을 눌렀을 때 아래에서 올라오는 프로필 시트. 내용은 열릴 때 getProfile로 받아 온다.
 * 실명·부서는 회원에게만 오므로(서버가 세션으로 판단) 페이지 HTML에 미리 실리지 않는다.
 */
export default function ProfilePopup({ userId, nickname, onClose }: { userId: string; nickname: string; onClose: () => void }) {
  // undefined = 불러오는 중, null = 실패/없는 회원
  const [profile, setProfile] = useState<ProfileView | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getProfile(userId)
      .then((p) => alive && setProfile(p))
      .catch(() => alive && setProfile(null));
    // 응답 전에 닫히면 늦게 온 결과로 상태를 바꾸지 않는다.
    return () => {
      alive = false;
    };
  }, [userId]);

  return (
    <BottomSheet open title={`${nickname} 프로필`} onClose={onClose}>
      <div className="space-y-5 pt-1">
        <div className="flex items-center gap-4">
          <Avatar src={profile?.profileImageUrl} name={nickname} size={64} alt={`${nickname} 프로필 사진`} />
          <div className="min-w-0">
            <p className="text-lg font-bold truncate">{nickname}</p>
            {profile?.badge && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 text-xs font-semibold">
                {profile.badge.kind === 'president' ? badgeLabel(profile.badge) : `${badgeLabel(profile.badge)} 참여`}
              </span>
            )}
          </div>
        </div>

        {profile === undefined && <p className="text-sm text-muted-foreground">불러오는 중…</p>}
        {profile === null && <p className="text-sm text-muted-foreground">프로필을 불러오지 못했습니다.</p>}
        {profile && (
          <dl className="rounded-2xl bg-muted/60 divide-y divide-border text-[15px]">
            {/* 회원 전용 항목: 비회원 응답에는 키가 없어 줄 자체를 그리지 않는다. */}
            {'displayName' in profile && <Row label="실명">{profile.displayName || '-'}</Row>}
            {'department' in profile && <Row label="부서">{profile.department || '-'}</Row>}
            <Row label="소개">
              <span className="whitespace-pre-wrap">{profile.bio || '-'}</span>
            </Row>
          </dl>
        )}
      </div>
    </BottomSheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3">
      <dt className="w-10 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

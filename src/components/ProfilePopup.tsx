'use client';

import { useEffect, useState } from 'react';
import { getProfile, type ProfileView } from '@/app/actions/profile';
import { badgeLabel } from '@/lib/badge';
import Overlay from './Overlay';

/**
 * 닉네임을 눌렀을 때 뜨는 프로필 팝업. 내용은 열릴 때 getProfile로 받아 온다.
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
    <Overlay label={`${nickname} 프로필`} onClose={onClose} className="bg-black/50">
      <div className="relative w-full max-w-sm bg-card text-card-foreground border border-border rounded-2xl shadow-lg p-6 space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-semibold hover:bg-muted"
        >
          닫기
        </button>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 shrink-0 rounded-full bg-muted overflow-hidden flex items-center justify-center">
            {profile?.profileImageUrl ? (
              <img src={profile.profileImageUrl} alt={`${nickname} 프로필 사진`} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">{[...nickname][0]?.toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{nickname}</h2>
            {profile?.badge && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">
                {profile.badge.kind === 'president' ? badgeLabel(profile.badge) : `${badgeLabel(profile.badge)} 참여`}
              </span>
            )}
          </div>
        </div>

        {profile === undefined && <p className="text-sm text-muted-foreground">불러오는 중…</p>}
        {profile === null && <p className="text-sm text-muted-foreground">프로필을 불러오지 못했습니다.</p>}
        {profile && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {/* 회원 전용 항목: 비회원 응답에는 키가 없어 줄 자체를 그리지 않는다. */}
            {'displayName' in profile && (
              <>
                <dt className="text-muted-foreground">실명</dt>
                <dd>{profile.displayName || '-'}</dd>
              </>
            )}
            {'department' in profile && (
              <>
                <dt className="text-muted-foreground">부서</dt>
                <dd>{profile.department || '-'}</dd>
              </>
            )}
            <dt className="text-muted-foreground">소개</dt>
            <dd className="whitespace-pre-wrap">{profile.bio || '-'}</dd>
          </dl>
        )}
      </div>
    </Overlay>
  );
}

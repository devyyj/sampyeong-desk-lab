'use client';

import { useActionState, useState } from 'react';
import { updateProfile } from '@/app/actions/mypage';

export default function MypageForm({ user }: { user: any }) {
  const [state, formAction] = useActionState(updateProfile, null as any);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  const isPinMatched = !newPin || newPin === confirmNewPin;
  const isPinValid = !newPin || newPin.length === 4;

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="flex flex-col items-center gap-4 w-full md:w-1/3">
          <div className="w-32 h-32 rounded-full bg-muted border-4 border-background shadow-sm overflow-hidden flex items-center justify-center relative group">
            {user.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-muted-foreground">{user.username[0].toUpperCase()}</span>
            )}
            <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-colors">
              <span className="text-white text-xs font-semibold">변경</span>
            </div>
          </div>
          <input
            type="file"
            name="profileImage"
            accept="image/*"
            className="w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
          />
        </div>

        <div className="flex-1 w-full space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">아이디</label>
            <input
              type="text"
              value={user.username}
              disabled
              className="w-full px-4 py-2 border border-border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="department" className="block text-sm font-medium text-foreground mb-1">
              소속 부서(팀)
            </label>
            <input
              type="text"
              id="department"
              name="department"
              defaultValue={user.department}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-foreground mb-1">
              한 줄 자기소개
            </label>
            <input
              type="text"
              id="bio"
              name="bio"
              defaultValue={user.bio || ''}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="자신을 소개해보세요."
            />
          </div>

          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-medium text-foreground mb-3">비밀번호 변경</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="newPin" className="block text-sm font-medium text-foreground mb-1">
                  새 비밀번호 (4자리 PIN)
                </label>
                <input
                  type="password"
                  id="newPin"
                  name="newPin"
                  maxLength={4}
                  pattern="\d{4}"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="변경하려면 입력 (4자리 숫자)"
                />
              </div>

              {newPin.length > 0 && (
                <div>
                  <label htmlFor="confirmNewPin" className="block text-sm font-medium text-foreground mb-1">
                    새 비밀번호 확인
                  </label>
                  <input
                    type="password"
                    id="confirmNewPin"
                    name="confirmNewPin"
                    maxLength={4}
                    pattern="\d{4}"
                    required
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 ${confirmNewPin && !isPinMatched ? 'border-red-500 focus:ring-red-500' : 'border-border focus:ring-primary-500'}`}
                    placeholder="새 비밀번호를 다시 입력해주세요"
                  />
                  {confirmNewPin && !isPinMatched && (
                    <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
                  )}
                  {confirmNewPin && isPinMatched && isPinValid && (
                    <p className="text-xs text-green-500 mt-1">비밀번호가 일치합니다.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-red-500 font-medium text-center">{state.error}</p>
      )}
      
      {state?.success && (
        <p className="text-sm text-green-500 font-medium text-center">{state.success}</p>
      )}

      <div className="flex justify-between pt-6 border-t border-border">
        <button
          type="button"
          onClick={() => {
            if (confirm('정말로 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
              // TODO: 회원 탈퇴 로직 추가
              alert('준비 중인 기능입니다.');
            }
          }}
          className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 font-medium rounded-lg transition-colors"
        >
          회원 탈퇴
        </button>
        
        <button
          type="submit"
          disabled={!isPinMatched || !isPinValid}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${(!isPinMatched || !isPinValid) ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
        >
          정보 수정
        </button>
      </div>
    </form>
  );
}

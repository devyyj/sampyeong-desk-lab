'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateProfile } from '@/app/actions/mypage';
import { fieldError, fieldHint, fieldInput, fieldLabel, fieldSuccess, submitButton } from '@/lib/form-styles';

export default function MypageForm({ user }: { user: any }) {
  const [state, formAction] = useActionState(updateProfile, null as any);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  // 새로 고른 사진의 미리보기 URL. 사진을 눌러 파일을 골랐을 때 바로 바뀐 모습을 보여주기 위함이다.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 이전 미리보기 blob URL은 더 이상 쓰지 않으므로 메모리 누수를 막기 위해 해제한다.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isPinMatched = !newPin || newPin === confirmNewPin;
  const isPinValid = !newPin || newPin.length === 4;

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-2 pt-2">
          {/* 사진 영역을 파일 입력의 label로 만들어, 사진을 눌러도 브라우저의 파일 선택 창이 열리게 한다. */}
          <label
            htmlFor="profileImage"
            className="w-24 h-24 rounded-full bg-muted ring-1 ring-black/5 overflow-hidden flex items-center justify-center relative cursor-pointer"
          >
            {previewUrl || user.profileImageUrl ? (
              <img src={previewUrl || user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              // 아이디는 로그인에만 쓰고 화면에 드러내지 않으므로 닉네임 첫 글자를 쓴다.
              <span className="text-4xl font-bold text-muted-foreground">{[...user.nickname][0]?.toUpperCase()}</span>
            )}
          </label>
          {/* 사진만으로는 누를 수 있다는 것을 알기 어려워 아래에 글자 버튼을 함께 둔다(같은 파일 입력을 연다). */}
          <label htmlFor="profileImage" className="text-[14px] font-semibold cursor-pointer" aria-hidden="true">
            사진 변경
          </label>
          <input
            type="file"
            id="profileImage"
            name="profileImage"
            accept="image/*"
            aria-label="프로필 사진 변경"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreviewUrl(file ? URL.createObjectURL(file) : null);
            }}
            className="sr-only"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="nickname" className={fieldLabel}>
              닉네임 <span className="text-red-500">*</span>
            </label>
            {/* 게시글·댓글에 보이는 이름. 중복 여부는 저장할 때 서버(DB 고유 인덱스)가 판정한다. */}
            <input
              type="text"
              id="nickname"
              name="nickname"
              required
              minLength={2}
              maxLength={20}
              defaultValue={user.nickname}
              className={fieldInput}
            />
            <p className={fieldHint}>게시글과 댓글에 이 이름이 보입니다. (2~20자)</p>
          </div>

          <div>
            <label htmlFor="loginId" className={fieldLabel}>로그인 아이디</label>
            {/* name이 없어 폼으로 전송되지 않는다(아이디는 바꿀 수 없음). */}
            <input
              type="text"
              id="loginId"
              value={user.username}
              disabled
              className={fieldInput}
            />
          </div>

          <div>
            <label htmlFor="department" className={fieldLabel}>
              소속 부서(팀)
            </label>
            <input
              type="text"
              id="department"
              name="department"
              defaultValue={user.department}
              className={fieldInput}
            />
          </div>

          <div>
            <label htmlFor="bio" className={fieldLabel}>
              한 줄 자기소개
            </label>
            <input
              type="text"
              id="bio"
              name="bio"
              defaultValue={user.bio || ''}
              className={fieldInput}
              placeholder="자신을 소개해보세요."
            />
          </div>

          <div className="pt-5 mt-2 border-t border-border">
            <h3 className="text-[15px] font-bold mb-3">비밀번호 변경</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="newPin" className={fieldLabel}>
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
                  className={fieldInput}
                  placeholder="변경하려면 입력 (4자리 숫자)"
                />
              </div>

              {newPin.length > 0 && (
                <div>
                  <label htmlFor="confirmNewPin" className={fieldLabel}>
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
                    className={`${fieldInput} ${confirmNewPin && !isPinMatched ? 'ring-2 ring-red-500' : ''}`}
                    placeholder="새 비밀번호를 다시 입력해주세요"
                  />
                  {confirmNewPin && !isPinMatched && (
                    <p className="mt-1.5 text-xs text-red-600">비밀번호가 일치하지 않습니다.</p>
                  )}
                  {confirmNewPin && isPinMatched && isPinValid && (
                    <p className="mt-1.5 text-xs text-green-600">비밀번호가 일치합니다.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {state?.error && (
        <p role="alert" className={`${fieldError} text-center`}>{state.error}</p>
      )}
      
      {state?.success && (
        <p role="status" className={`${fieldSuccess} text-center`}>{state.success}</p>
      )}

      <div className="flex flex-col-reverse items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            if (confirm('정말로 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
              // TODO: 회원 탈퇴 로직 추가
              alert('준비 중인 기능입니다.');
            }
          }}
          className="h-10 px-4 text-[13px] text-muted-foreground underline underline-offset-2"
        >
          회원 탈퇴
        </button>
        
        <button
          type="submit"
          disabled={!isPinMatched || !isPinValid}
          className={submitButton}
        >
          정보 수정
        </button>
      </div>
    </form>
  );
}

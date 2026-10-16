'use client';

import { useActionState } from 'react';
import { createMember } from '@/app/actions/admin';
import FormHeader from '@/components/FormHeader';
import { fieldError, fieldHint, fieldInput, fieldLabel, fieldSuccess } from '@/lib/form-styles';

/**
 * 새 회원 계정 발급 폼(관리자 전용). 게시글·보드게임 생성과 같은 전체 화면 폼 모양을 쓴다.
 * PIN을 비우면 기본 초기 PIN(1234)이 적용되고, 새 회원은 첫 로그인에서 PIN을 바꿔야 한다.
 * 연속으로 여러 명을 발급하는 경우가 많아, 성공해도 화면을 떠나지 않고 결과 문구만 보여준다.
 */
export default function CreateMemberForm() {
  const [state, formAction, isPending] = useActionState(createMember, null);

  return (
    <form action={formAction}>
      <FormHeader title="회원 추가" cancelHref="/members" submitLabel="회원 생성" busy={isPending} />
      <div className="space-y-4">
        <div>
          <label htmlFor="username" className={fieldLabel}>아이디 (사내 ID)</label>
          {/* 아이디가 닉네임 최초값이 되므로 닉네임 길이(20자)에 맞춘다. 서버도 다시 검사한다. */}
          <input id="username" name="username" required maxLength={20} autoCapitalize="none" placeholder="예: youngyong.jo" className={fieldInput} />
        </div>
        <div>
          <label htmlFor="displayName" className={fieldLabel}>이름</label>
          <input id="displayName" name="displayName" required placeholder="실명" className={fieldInput} />
        </div>
        <div>
          <label htmlFor="department" className={fieldLabel}>소속 부서(팀)</label>
          <input id="department" name="department" required className={fieldInput} />
        </div>
        <div>
          <label htmlFor="pin" className={fieldLabel}>초기 PIN</label>
          <input id="pin" name="pin" maxLength={4} pattern="\d{4}" inputMode="numeric" placeholder="비우면 1234" className={fieldInput} />
          <p className={fieldHint}>새 회원은 첫 로그인 때 본인만 아는 PIN으로 바꿔야 합니다.</p>
        </div>
        {state && ('error' in state ? <p role="alert" className={fieldError}>{state.error}</p> : <p role="status" className={fieldSuccess}>{state.success}</p>)}
      </div>
    </form>
  );
}

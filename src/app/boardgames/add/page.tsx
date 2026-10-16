'use client';

import { useActionState } from 'react';
import { addBoardGame } from '@/app/actions/boardgame';
import FormHeader from '@/components/FormHeader';
import { checkboxRow, fieldError, fieldInput, fieldLabel } from '@/lib/form-styles';

/** 보드게임 등록. 게시글·회원 생성과 같은 전체 화면 폼(취소 | 제목 | 등록)을 쓴다. 보드게임 탭의 ＋로 들어온다. */
export default function AddBoardGamePage() {
  const [state, formAction, isPending] = useActionState(addBoardGame, null as any);

  return (
    <form action={formAction}>
      <FormHeader title="새 보드게임 등록" cancelHref="/boardgames" submitLabel="등록하기" busy={isPending} />
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className={fieldLabel}>
            보드게임 이름 <span className="text-red-500">*</span>
          </label>
          <input type="text" id="name" name="name" required className={fieldInput} placeholder="예: 스플렌더" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="recommendedPlayers" className={fieldLabel}>추천 인원</label>
            <input type="text" id="recommendedPlayers" name="recommendedPlayers" className={fieldInput} placeholder="예: 2~4명" />
          </div>
          <div>
            <label htmlFor="playTime" className={fieldLabel}>플레이 시간</label>
            <input type="text" id="playTime" name="playTime" className={fieldInput} placeholder="예: 30분~1시간" />
          </div>
        </div>

        {/* 보드게임은 보관 상태 대신 공용 보관함에 있는지만 관리한다. 대부분 개인 보유라 기본은 꺼 둔다. */}
        <label className={checkboxRow}>
          <input type="checkbox" name="inSharedCabinet" className="h-5 w-5 rounded accent-foreground" />
          공용 보관함에 보관
        </label>

        {state?.error && <p role="alert" className={fieldError}>{state.error}</p>}
      </div>
    </form>
  );
}

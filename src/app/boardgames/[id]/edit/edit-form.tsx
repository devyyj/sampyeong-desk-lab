'use client';

import { useActionState } from 'react';
import { updateBoardGame } from '@/app/actions/boardgame';
import FormHeader from '@/components/FormHeader';
import { checkboxRow, fieldError, fieldInput, fieldLabel } from '@/lib/form-styles';

type GameType = {
  id: string;
  name: string;
  recommendedPlayers: string | null;
  playTime: string | null;
  inSharedCabinet: boolean;
};

/** 보드게임 수정. 등록 화면과 같은 전체 화면 폼(취소 | 보드게임 수정 | 수정완료)이다. */
export function EditBoardGameForm({ game }: { game: GameType }) {
  const [state, formAction, isPending] = useActionState(updateBoardGame, null as any);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={game.id} />
      <FormHeader title="보드게임 수정" cancelHref="/boardgames" submitLabel="수정완료" busy={isPending} />
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className={fieldLabel}>
            보드게임 이름 <span className="text-red-500">*</span>
          </label>
          <input type="text" id="name" name="name" defaultValue={game.name} required className={fieldInput} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="recommendedPlayers" className={fieldLabel}>추천 인원</label>
            <input type="text" id="recommendedPlayers" name="recommendedPlayers" defaultValue={game.recommendedPlayers || ''} placeholder="예: 2~4명" className={fieldInput} />
          </div>
          <div>
            <label htmlFor="playTime" className={fieldLabel}>플레이 시간</label>
            <input type="text" id="playTime" name="playTime" defaultValue={game.playTime || ''} placeholder="예: 30~60분" className={fieldInput} />
          </div>
        </div>

        {/* 보관 상태(보관 중·플레이 중·대여 중) 대신 공용 보관함에 있는지만 관리한다. */}
        <label className={checkboxRow}>
          <input type="checkbox" name="inSharedCabinet" defaultChecked={game.inSharedCabinet} className="h-5 w-5 rounded accent-foreground" />
          공용 보관함에 보관
        </label>

        {state?.error && <p role="alert" className={fieldError}>{state.error}</p>}
      </div>
    </form>
  );
}

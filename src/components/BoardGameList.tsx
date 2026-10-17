'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteBoardGame } from '@/app/actions/boardgame';
import BottomSheet, { SheetAction } from './BottomSheet';
import { useConfirm } from './ConfirmDialog';
import LikeButton from './LikeButton';

/**
 * 화면에 넘기는 보드게임 한 개. ownerName은 회원에게만 채워 넘긴다(page가 비회원이면 null로 보냄).
 * 클라이언트 컴포넌트 props는 HTML에 그대로 실리므로, 실명을 여기서 숨기는 것으로는 부족하고 아예 넘기지 않아야 한다.
 */
export type BoardGameItem = {
  id: string;
  name: string;
  category: string;
  recommendedPlayers: string | null;
  playTime: string | null;
  inSharedCabinet: boolean;
  thumbnailUrl: string | null;
  ownerName: string | null;
  likeCount: number;
  liked: boolean;
};

/**
 * 보드게임 목록(두 줄 리스트) + 누르면 올라오는 상세 시트.
 * 목록에서 수정·삭제 버튼을 빼고 상세 시트로 옮겨, 목록은 훑어보기에만 집중하게 했다(86개 수준).
 * 상세 시트는 목록에서 이미 받은 값으로 채우므로 별도 조회가 없다.
 */
export default function BoardGameList({ games, canEdit, loggedIn = canEdit }: { games: BoardGameItem[]; canEdit: boolean; /** 좋아요를 누를 수 있는지(비회원은 수만 보고 누르면 로그인 안내) */ loggedIn?: boolean }) {
  const [selected, setSelected] = useState<BoardGameItem | null>(null);
  // 지운 게임은 서버가 화면을 다시 그려 주기를 기다리지 않고 바로 뺀다.
  // 탭 화면은 (tabs)/loading.tsx 경계 안에 있는데, 이 경계 안에서는 삭제 액션의 revalidatePath·router.refresh()가
  // 새 목록을 받아 오고도(응답에는 지운 게임이 빠져 있음) 화면에 반영되지 않는 현상이 E2E에서 재현됐다(Next 16.2).
  // 피드(FeedList)가 삭제한 카드를 목록 상태에서 직접 빼는 것과 같은 방식으로, 갱신 여부와 상관없이 맞게 보이게 한다.
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(() => new Set());
  const visible = removedIds.size === 0 ? games : games.filter((game) => !removedIds.has(game.id));

  return (
    <>
      <div className="divide-y divide-border">
        {visible.map((game) => {
          const details = [game.category, game.recommendedPlayers, game.playTime].filter(Boolean).join(' · ');
          return (
            // 줄 전체를 누를 수 있게: 제목 버튼의 ::after가 줄 전체를 덮는다(제목 안에 버튼을 두어 h3 구조는 유지).
            <article key={game.id} className="relative py-3 flex items-center gap-2 active:bg-muted">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-[17px] font-semibold">
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-label={`${game.name} 상세 보기`}
                      onClick={() => setSelected(game)}
                      className="text-left after:absolute after:inset-0 focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-foreground/30"
                    >
                      {game.name}
                    </button>
                  </h3>
                  {/* 보관 상태(보관 중·대여 중 등)는 관리하지 않고 공용 보관함에 있는지만 표시한다. */}
                  {game.inSharedCabinet && <CabinetBadge />}
                </div>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  {details}
                  {/* 보유자는 실명이라 회원 명부(/members)와 같은 기준으로 로그인한 회원에게만 보여준다. */}
                  {/* 누구에게 빌릴지가 목록을 보는 주된 이유라, 보유자 이름은 본문색·굵게 강조한다. */}
                  {game.ownerName && (
                    <span>
                      {' · 보유자 '}
                      <strong className="font-semibold text-foreground">{game.ownerName}</strong>
                    </span>
                  )}
                </p>
              </div>
              {/* 줄 전체를 덮는 상세 보기 버튼(::after) 위로 올려야 좋아요를 누를 수 있다. */}
              <div className="relative z-10 shrink-0">
                <LikeButton target="boardgame" id={game.id} liked={game.liked} count={game.likeCount} canLike={loggedIn} />
              </div>
            </article>
          );
        })}
      </div>

      <BottomSheet open={selected !== null} title={selected?.name ?? ''} onClose={() => setSelected(null)}>
        {selected && (
          <GameDetail
            game={selected}
            canEdit={canEdit}
            onDeleted={(id) => {
              setSelected(null);
              setRemovedIds((prev) => new Set(prev).add(id));
            }}
          />
        )}
      </BottomSheet>
    </>
  );
}

function CabinetBadge() {
  return <span className="px-1.5 py-px rounded-md text-[12px] font-bold bg-foreground text-background">공용 보관함</span>;
}

function GameDetail({ game, canEdit, onDeleted }: { game: BoardGameItem; canEdit: boolean; onDeleted: (id: string) => void }) {
  const router = useRouter();
  const [isDeleting, startDelete] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const rows = [
    ['카테고리', game.category],
    ['인원', game.recommendedPlayers],
    ['시간', game.playTime],
    ['보유자', game.ownerName],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  const onDelete = async () => {
    if (!(await confirm({ title: `'${game.name}'을(를) 삭제할까요?`, confirmLabel: '삭제', danger: true }))) return;
    startDelete(async () => {
      // 권한은 deleteBoardGame이 서버에서 다시 확인한다.
      await deleteBoardGame(game.id);
      onDeleted(game.id);
      // 목록 개수(전체 N) 같은 서버 값도 맞추도록 다시 그리기를 요청한다(반영되지 않아도 목록은 위에서 이미 맞다).
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 pt-1">
      {game.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={game.thumbnailUrl} alt={`${game.name} 사진`} className="w-full max-h-64 object-contain rounded-2xl bg-muted" />
      )}
      {game.inSharedCabinet && <CabinetBadge />}
      <dl className="rounded-2xl bg-muted/60 divide-y divide-border text-[16px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-4 px-4 py-3">
            <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
            <dd className={`min-w-0 flex-1 ${label === '보유자' ? 'font-semibold' : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {canEdit && (
        <div className="border-t border-border pt-2">
          <SheetAction href={`/boardgames/${game.id}/edit`}>수정</SheetAction>
          <SheetAction danger onClick={onDelete} disabled={isDeleting}>
            {isDeleting ? '삭제하는 중…' : '삭제'}
          </SheetAction>
          {confirmDialog}
        </div>
      )}
    </div>
  );
}

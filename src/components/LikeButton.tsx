'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { toggleLike, type LikeTarget } from '@/app/actions/reactions';

type LikeState = { liked: boolean; count: number };

/**
 * 게시글·활동 기록·댓글 공용 좋아요 버튼.
 * 회원이 누르면 useOptimistic으로 즉시 반영하고, 서버 응답(최종 상태·개수)으로 확정한다.
 * 실패하면 transition이 끝나면서 낙관적 값이 버려져 원래 상태로 돌아가고, 오류를 보여준다.
 * 비회원에게는 수를 보여주고, 누르면 서버를 부르지 않고 로그인 안내만 한다. 누르면 안내가 뜨는 버튼이라
 * aria-disabled를 두지 않는다(비활성으로 읽히면 안내를 받을 수 있다는 것을 알 수 없다).
 */
export default function LikeButton({
  target,
  id,
  liked,
  count,
  canLike,
}: LikeState & { target: LikeTarget; id: string; canLike: boolean }) {
  const [confirmed, setConfirmed] = useState<LikeState>({ liked, count });
  // 서버가 화면을 다시 그려 새 값을 주면(revalidatePath) 그 값을 따른다. effect에서 setState하면 한 번 더 렌더링되므로
  // React 문서의 "props가 바뀌면 렌더 중에 state 조정" 방식으로 처리한다.
  const [fromProps, setFromProps] = useState<LikeState>({ liked, count });
  if (fromProps.liked !== liked || fromProps.count !== count) {
    setFromProps({ liked, count });
    setConfirmed({ liked, count });
  }

  // 리듀서 형태(현재 값을 뒤집기)를 쓰면 응답으로 confirmed가 바뀌는 순간 리듀서가 새 값에 다시 적용돼
  // 한 번 더 뒤집힌 값이 잠깐 보인다. 그래서 누른 시점의 결과를 직접 계산해 낙관적 값으로 넣는다.
  const [shown, setOptimistic] = useOptimistic(confirmed);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const onClick = () => {
    if (!canLike) {
      setMessage('로그인하면 좋아요를 누를 수 있습니다.');
      return;
    }
    // 응답을 기다리는 동안의 연타는 무시한다(서버는 연타도 안전하게 처리하지만 화면 깜빡임을 줄인다).
    if (isPending) return;
    setMessage(null);
    const next = { liked: !shown.liked, count: shown.count + (shown.liked ? -1 : 1) };
    startTransition(async () => {
      setOptimistic(next);
      const result = await toggleLike(target, id);
      // await 뒤의 상태 변경은 transition 밖으로 빠지므로 다시 감싼다(React 문서 권장).
      // 그래야 낙관적 값이 확정값으로 한 번에 바뀐다. 실패하면 confirmed가 그대로라 원래 상태로 돌아간다.
      startTransition(() => {
        if ('error' in result) setMessage(result.error);
        else setConfirmed(result);
      });
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-label={`좋아요 ${shown.count}`}
        aria-pressed={shown.liked}
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors ${
          shown.liked ? 'text-red-500' : 'text-muted-foreground'
        } ${canLike ? 'hover:bg-muted' : 'cursor-default'}`}
      >
        <span aria-hidden="true">{shown.liked ? '❤️' : '🤍'}</span>
        <span className="tabular-nums">{shown.count}</span>
      </button>
      {message && (
        <span role="alert" className="text-xs text-red-500">
          {message}
        </span>
      )}
    </span>
  );
}

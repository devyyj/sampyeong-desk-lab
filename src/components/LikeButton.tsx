'use client';

import { useRef, useState } from 'react';
import { setLike, type LikeTarget } from '@/app/actions/reactions';
import { HeartIcon } from './icons';

type LikeState = { liked: boolean; count: number };

/**
 * 게시글·활동 기록·댓글·보드게임 공용 좋아요 버튼.
 *
 * 누르는 즉시 화면(shown)을 바꾸고, 서버에는 "이 상태로 맞춰 달라(setLike)"를 보낸다.
 * 예전에는 응답을 기다리는 동안 클릭을 무시해서, 빠르게 눌렀다 떼면 해제가 안 되고 간격을 두고 눌러야 했다.
 * 이제는 응답 대기 중에도 클릭을 받고, 요청은 한 번에 하나씩만 보낸다(sync 루프):
 *   응답이 오면 그 사이 사용자가 마지막으로 누른 상태(want)와 비교해, 다르면 그 상태로 한 번 더 보낸다.
 *   동시에 여러 요청을 보내면 서버 도착 순서가 바뀌어 엉뚱한 상태로 끝날 수 있어서 직렬화한다.
 * 연타를 아무리 해도 요청은 최대 "진행 중 1개 + 마지막 의도 1개"로 모인다.
 *
 * 실패하면 마지막으로 서버가 확정한 상태로 되돌리고 오류를 보여준다.
 * 비회원에게는 수를 보여주고, 누르면 서버를 부르지 않고 로그인 안내만 한다. 누르면 안내가 뜨는 버튼이라
 * aria-disabled를 두지 않는다(비활성으로 읽히면 안내를 받을 수 있다는 것을 알 수 없다).
 */
export default function LikeButton({
  target,
  id,
  liked,
  count,
  canLike,
  size = 'md',
}: LikeState & { target: LikeTarget; id: string; canLike: boolean; /** sm: 댓글 안의 작은 좋아요 */ size?: 'md' | 'sm' }) {
  // 화면에 보이는 상태(누르는 즉시 바뀜)와 서버가 마지막으로 확정한 상태(실패 시 되돌릴 값).
  const [shown, setShown] = useState<LikeState>({ liked, count });
  const [confirmed, setConfirmed] = useState<LikeState>({ liked, count });
  // 요청을 주고받는 중인지. 렌더 중 판단(아래 props 동기화)에 쓰므로 state로 둔다.
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // 사용자가 마지막으로 누른 상태와 루프 실행 여부. 응답을 기다리는 async 루프가 렌더와 무관하게
  // 최신 값을 읽어야 해서 ref로 두고, 이벤트 핸들러·루프 안에서만 읽고 쓴다(렌더 중에는 건드리지 않는다).
  const want = useRef(liked);
  const syncing = useRef(false);

  // 서버가 화면을 다시 그려 새 값을 주면(revalidatePath) 그 값을 따른다. 단, 요청을 주고받는 중에는
  // 사용자가 누른 상태가 더 최신이므로 화면은 그대로 두고, 끝나면 루프가 서버 값으로 확정한다.
  // effect에서 setState하면 한 번 더 렌더링되므로 React 문서의 "props가 바뀌면 렌더 중에 state 조정" 방식으로 처리한다.
  const [fromProps, setFromProps] = useState<LikeState>({ liked, count });
  if (fromProps.liked !== liked || fromProps.count !== count) {
    setFromProps({ liked, count });
    if (!busy) {
      setConfirmed({ liked, count });
      setShown({ liked, count });
    }
  }

  // base: 루프를 시작할 때의 서버 확정 상태. 루프 안에서는 지역 변수로 갱신해 가며 want와 비교한다.
  const sync = async (base: LikeState) => {
    syncing.current = true;
    setBusy(true);
    let server = base;
    try {
      while (want.current !== server.liked) {
        const result = await setLike(target, id, want.current);
        if ('error' in result) {
          want.current = server.liked;
          setMessage(result.error);
          break;
        }
        server = result;
      }
      // 서버와 의도가 같아졌다(또는 실패해 확정 상태로 되돌린다).
      // 개수는 그 사이 다른 회원이 누른 것까지 반영된 서버 값을 따른다.
      setConfirmed(server);
      setShown(server);
    } finally {
      syncing.current = false;
      setBusy(false);
    }
  };

  const onClick = () => {
    if (!canLike) {
      setMessage('로그인하면 좋아요를 누를 수 있습니다.');
      return;
    }
    setMessage(null);
    const next = { liked: !shown.liked, count: Math.max(0, shown.count + (shown.liked ? -1 : 1)) };
    setShown(next);
    want.current = next.liked;
    // 이미 요청 중이면 그 루프가 응답 뒤 want를 보고 이어서 처리한다.
    if (!syncing.current) void sync(confirmed);
  };

  const small = size === 'sm';
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-label={`좋아요 ${shown.count}`}
        aria-pressed={shown.liked}
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 rounded-full transition-colors active:scale-95 touch-manipulation ${
          small ? 'h-8 px-1.5 text-xs' : 'h-10 px-2 text-[16px]'
        } ${shown.liked ? 'text-like' : small ? 'text-muted-foreground' : 'text-foreground'} ${canLike ? 'hover:bg-muted' : 'cursor-default'}`}
      >
        <HeartIcon size={small ? 16 : 24} filled={shown.liked} />
        <span className={`tabular-nums font-medium ${shown.liked ? 'text-foreground' : ''}`}>{shown.count}</span>
      </button>
      {message && (
        <span role="alert" className="text-xs text-red-500">
          {message}
        </span>
      )}
    </span>
  );
}

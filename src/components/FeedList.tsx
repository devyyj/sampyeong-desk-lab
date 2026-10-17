'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadFeedItem, loadMoreFeed } from '@/app/actions/feed';
import type { FeedFilter } from '@/lib/feed-filter';
import type { FeedPage } from '@/lib/feed';
import PostCard from './PostCard';
import EmptyState from './EmptyState';

/**
 * 통합 피드 목록(무한 스크롤). 첫 페이지는 서버가 그려 넘기고, 바닥 근처에 닿으면 같은 필터로
 * 다음 페이지를 서버 액션(loadMoreFeed)으로 받아 이어 붙인다. 활동 사진은 페이지마다 서명이 필요해
 * 한 번에 다 그리지 않는다(설계 §5.2).
 *
 * 필터가 바뀌면 부모가 key를 바꿔 이 컴포넌트를 새로 만든다(이전 필터의 목록 상태가 남지 않게).
 * IntersectionObserver가 없거나 자동 로드가 실패했을 때를 위해 "글 더 보기" 버튼을 함께 두고,
 * 실패하면 자동 로드를 멈춰(같은 오류로 요청이 반복되지 않게) 버튼으로만 다시 시도한다.
 */
export default function FeedList({
  filter,
  initial,
  viewer,
  loginHref = '/login?redirect=%2F',
}: {
  filter: FeedFilter;
  initial: FeedPage;
  viewer: { id: string; isAdmin: boolean } | null;
  loginHref?: string;
}) {
  // offset은 서버에서 받은 글 수 누적이다. 겹친 글을 거르거나 삭제하면 items 길이와 달라지므로 따로 센다.
  const [list, setList] = useState({ items: initial.items, hasMore: initial.hasMore, offset: initial.items.length });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // state는 렌더 후에야 바뀌므로, 같은 프레임에 관찰 콜백이 두 번 와도 한 번만 요청하도록 ref로 막는다.
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !list.hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadMoreFeed(filter, list.offset);
      setList((prev) => {
        // 스크롤 중 새 글이 올라오면 offset이 한 칸 밀려 이미 받은 글이 다시 올 수 있다.
        const seen = new Set(prev.items.map((p) => p.id));
        return {
          items: [...prev.items, ...page.items.filter((p) => !seen.has(p.id))],
          hasMore: page.hasMore,
          offset: prev.offset + page.items.length,
        };
      });
    } catch {
      setFailed(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [filter, list.hasMore, list.offset]);

  // 페이지를 받을 때마다 관찰을 새로 건다. 새 observer는 처음 관찰할 때 현재 교차 상태를 한 번 알려주므로,
  // 받아 온 페이지가 짧아 바닥 표시가 여전히 화면 안에 있어도 다음 페이지를 이어서 부른다.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || failed || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      // 바닥에 완전히 닿기 전에 미리 불러와 스크롤이 끊기지 않게 한다.
      { rootMargin: '600px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, failed]);

  // 댓글이 바뀐 글은 그 카드만 서버에서 다시 받아 바꿔 끼운다(목록이 클라이언트 상태라 revalidate만으로는 안 바뀜).
  // 그 사이 지워졌으면 뺀다. 실패하면 그대로 둔다(다음 새로고침에 맞춰진다).
  const refresh = async (id: string) => {
    try {
      const fresh = await loadFeedItem(id);
      setList((prev) => ({
        ...prev,
        items: fresh ? prev.items.map((p) => (p.id === id ? fresh : p)) : prev.items.filter((p) => p.id !== id),
      }));
    } catch {
      // 카드 갱신 실패는 치명적이지 않다.
    }
  };

  // 삭제한 글은 목록에서 바로 뺀다. 서버 offset은 그대로라 다음 페이지에서 한 건이 겹칠 수 있지만 위의 id 거르기로 막힌다.
  const remove = (id: string) => setList((prev) => ({ ...prev, items: prev.items.filter((p) => p.id !== id) }));

  if (list.items.length === 0 && !list.hasMore) {
    return <EmptyState title="아직 등록된 글이 없어요" description="오른쪽 아래 ＋ 버튼으로 첫 이야기를 남겨보세요." />;
  }

  return (
    <div>
      {/* 카드 사이 간격. 카드 테두리만으로 경계가 보이므로 구분선은 따로 두지 않는다. */}
      <div className="space-y-3">
        {list.items.map((item) => (
          <PostCard
            key={item.id}
            item={item}
            viewer={viewer}
            loginHref={loginHref}
            onChanged={() => void refresh(item.id)}
            onDeleted={() => remove(item.id)}
          />
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden className="h-px" />
      <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
        {failed && (
          <p role="alert" className="text-red-500">
            글을 더 불러오지 못했어요.
          </p>
        )}
        {loading && <p role="status">불러오는 중…</p>}
        {list.hasMore && !loading && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="h-11 px-5 rounded-full bg-muted text-foreground font-medium active:opacity-80"
          >
            글 더 보기
          </button>
        )}
        {!list.hasMore && <p>모든 글을 불러왔어요</p>}
      </div>
    </div>
  );
}

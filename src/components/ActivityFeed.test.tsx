import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import ActivityFeed from './ActivityFeed';
import { loadMoreActivities } from '@/app/actions/activities';
import type { ActivityListItem } from '@/lib/activity-list';

vi.mock('@/app/actions/activities', () => ({ loadMoreActivities: vi.fn() }));

// jsdom에는 IntersectionObserver가 없어 콜백을 잡아 두고 직접 호출한다.
let intersect: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
class FakeObserver {
  constructor(cb: typeof intersect) { intersect = cb; }
  observe() {}
  disconnect() {}
}

const seasons = [
  { id: 3, name: '시즌 3', period: '26년 2분기', count: 2 },
  { id: 2, name: '시즌 2', period: '26년 1분기', count: 5 },
];
const item = (id: string, seasonId: number, o: Partial<ActivityListItem> = {}): ActivityListItem => ({
  id, seasonId, date: '2026-04-01', type: 'LUNCH', title: `활동 ${id}`, photoCount: 0, likeCount: 0, commentCount: 0, ...o,
});
const sectionOf = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) });

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intersect = null;
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });

  it('시즌별로 묶어 큰 제목(이름·기간·전체 건수)을 붙이고, 줄마다 종류·날짜·사진·좋아요·댓글 수(0이면 생략)', () => {
    render(
      <ActivityFeed
        seasons={seasons}
        initial={{ items: [item('a', 3, { photoCount: 2, likeCount: 3 }), item('b', 3, { commentCount: 1 }), item('c', 2)], hasMore: false }}
      />,
    );
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      expect.stringContaining('시즌 3'),
      expect.stringContaining('시즌 2'),
    ]);
    expect(screen.getByRole('heading', { level: 2, name: /시즌 3/ })).toHaveTextContent('26년 2분기');
    expect(sectionOf('시즌 3')).toHaveTextContent('2건');
    const a = within(sectionOf('시즌 3')).getByRole('link', { name: /활동 a/ });
    expect(a).toHaveAttribute('href', '/activities/a');
    expect(a).toHaveTextContent('점심');
    // 날짜는 요일을 붙인 짧은 표기, 기계용 값은 dateTime에 그대로 둔다.
    expect(a.querySelector('time')).toHaveAttribute('dateTime', '2026-04-01');
    expect(a.querySelector('time')!.textContent).toMatch(/4월 1일 \(수\)$/);
    // 아이콘은 장식이고, 수는 "사진 2"처럼 읽힌다(모노크롬 아이콘이라 이모지 대신 숨김 텍스트로 뜻을 전한다).
    expect(a).toHaveTextContent('사진 2');
    expect(a).toHaveTextContent('좋아요 3');
    expect(a).not.toHaveTextContent('댓글');
    expect(within(sectionOf('시즌 3')).getByRole('link', { name: /활동 b/ })).toHaveTextContent('댓글 1');
    expect(within(sectionOf('시즌 2')).getAllByRole('link')).toHaveLength(1);
    // 더 없으면 더 보기 버튼도 없다.
    expect(screen.queryByRole('button', { name: '활동 더 보기' })).toBeNull();
  });

  it('바닥에 닿으면 다음 페이지를 이어 붙인다: 같은 시즌은 같은 묶음에, 겹친 활동은 한 번만', async () => {
    vi.mocked(loadMoreActivities).mockResolvedValueOnce({ items: [item('b', 3), item('c', 2), item('d', 2)], hasMore: false });
    render(<ActivityFeed seasons={seasons} initial={{ items: [item('a', 3), item('b', 3)], hasMore: true }} />);

    await act(async () => intersect!([{ isIntersecting: true }]));
    // offset은 받은 줄 수(겹침 제거 전) 기준이다.
    expect(loadMoreActivities).toHaveBeenCalledWith(2);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
    expect(within(sectionOf('시즌 3')).getAllByRole('link')).toHaveLength(2);
    expect(within(sectionOf('시즌 2')).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/activities/c', '/activities/d']);
    expect(screen.queryByRole('button', { name: '활동 더 보기' })).toBeNull();
    expect(screen.getByText('모든 활동을 불러왔습니다.')).toBeInTheDocument();
  });

  it('불러오는 중에 또 닿아도 한 번만 요청한다', async () => {
    let resolve!: (v: { items: ActivityListItem[]; hasMore: boolean }) => void;
    vi.mocked(loadMoreActivities).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render(<ActivityFeed seasons={seasons} initial={{ items: [item('a', 3)], hasMore: true }} />);
    await act(async () => intersect!([{ isIntersecting: true }]));
    await act(async () => intersect!([{ isIntersecting: true }]));
    expect(loadMoreActivities).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ items: [item('z', 2)], hasMore: true }));
    // 다음 요청은 누적 offset으로.
    vi.mocked(loadMoreActivities).mockResolvedValueOnce({ items: [], hasMore: false });
    fireEvent.click(screen.getByRole('button', { name: '활동 더 보기' }));
    await act(async () => {});
    expect(loadMoreActivities).toHaveBeenLastCalledWith(2);
  });

  it('실패하면 오류를 보여주고 더 보기 버튼으로 다시 시도할 수 있다', async () => {
    vi.mocked(loadMoreActivities).mockRejectedValueOnce(new Error('network'));
    render(<ActivityFeed seasons={seasons} initial={{ items: [item('a', 3)], hasMore: true }} />);
    await act(async () => intersect!([{ isIntersecting: true }]));
    expect(screen.getByRole('alert')).toHaveTextContent('활동을 더 불러오지 못했습니다.');

    vi.mocked(loadMoreActivities).mockResolvedValueOnce({ items: [item('b', 2)], hasMore: false });
    fireEvent.click(screen.getByRole('button', { name: '활동 더 보기' }));
    await act(async () => {});
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('link', { name: /활동 b/ })).toBeInTheDocument();
  });

  it('활동이 없으면 안내', () => {
    render(<ActivityFeed seasons={seasons} initial={{ items: [], hasMore: false }} />);
    expect(screen.getByText('기록된 활동이 없습니다.')).toBeInTheDocument();
  });
});

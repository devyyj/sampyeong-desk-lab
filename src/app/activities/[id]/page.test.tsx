import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { getSession } from '@/lib/session';
import { createSignedPhotoUrls } from '@/lib/storage-admin';
import ActivityDetailPage from './page';

vi.mock('@/db', () => ({ db: { query: { activities: { findFirst: vi.fn() } } } }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/storage-admin', () => ({ createSignedPhotoUrls: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

const ID = '0b5c9a52-6f1e-4c55-9d8e-0d1f6c2a7b11';
const activity = {
  id: ID,
  date: '2026-03-10',
  type: 'REGULAR',
  title: '제 8회 정기모임',
  bodyMd: '- **인원 : 8명**\n- 워드캡쳐',
  noteMd: '다음엔 스컬킹',
  season: { id: 2, name: '시즌 2', period: '26년 1분기' },
  photos: [
    { id: 'p1', storagePath: 's2/a/1.jpg', position: 0 },
    { id: 'p2', storagePath: 's2/a/2.jpg', position: 1 },
  ],
};

const page = async (id = ID) => render(await ActivityDetailPage({ params: Promise.resolve({ id }) }));

describe('ActivityDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.query.activities.findFirst).mockResolvedValue(activity as never);
  });

  it('uuid 형식이 아니면 DB 조회 없이 notFound (Postgres uuid 캐스팅 오류 방지)', async () => {
    await expect(page('not-a-uuid')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(db.query.activities.findFirst).not.toHaveBeenCalled();
    expect(notFound).toHaveBeenCalled();
  });

  it('없는 활동이면 notFound', async () => {
    vi.mocked(db.query.activities.findFirst).mockResolvedValueOnce(undefined as never);
    await expect(page()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('제목·종류·본문·비고를 보여주고 시즌 목록으로 돌아가는 링크를 둔다', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    await page();
    expect(screen.getByRole('heading', { name: '제 8회 정기모임' })).toBeInTheDocument();
    expect(screen.getByText('정기 모임')).toBeInTheDocument();
    expect(screen.getByText('인원 : 8명').tagName).toBe('STRONG');
    expect(screen.getByText('다음엔 스컬킹')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /시즌 2 활동 목록/ })).toHaveAttribute('href', '/activities?season=2');
  });

  it('비로그인이면 사진 대신 로그인 안내를 보여주고 signed URL을 발급하지 않는다', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    await page();
    expect(createSignedPhotoUrls).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('로그인하면 사진 2장을 볼 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', `/login?redirect=%2Factivities%2F${ID}`);
  });

  it('로그인하면 위치 순서대로 signed URL 사진을 보여주고, 실패한 사진은 대체 문구', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userId: 'u1' } as never);
    vi.mocked(createSignedPhotoUrls).mockResolvedValueOnce(['https://signed/1', null]);
    await page();
    expect(createSignedPhotoUrls).toHaveBeenCalledWith(['s2/a/1.jpg', 's2/a/2.jpg']);
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute('src', 'https://signed/1');
    expect(screen.getByText('사진을 불러오지 못했습니다.')).toBeInTheDocument();
  });

  it('사진이 없으면 사진 영역을 표시하지 않는다', async () => {
    vi.mocked(db.query.activities.findFirst).mockResolvedValueOnce({ ...activity, photos: [] } as never);
    vi.mocked(getSession).mockResolvedValueOnce(null);
    await page();
    expect(screen.queryByText(/로그인하면 사진/)).toBeNull();
    expect(screen.queryByRole('heading', { name: /사진/ })).toBeNull();
  });
});

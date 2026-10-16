import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { getSession } from '@/lib/session';
import { getAdminUser } from '@/lib/admin';
import { createSignedPhotoUrls } from '@/lib/storage-admin';
import EditPostPage from './page';

vi.mock('@/db', () => ({ db: { query: { posts: { findFirst: vi.fn() }, seasons: { findMany: vi.fn() } } } }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn() }));
vi.mock('@/lib/storage-admin', () => ({ createSignedPhotoUrls: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock('@/app/actions/post', () => ({ createPost: vi.fn(), updatePost: vi.fn(), requestPostImageUploads: vi.fn() }));
vi.mock('@/utils/supabase/client', () => ({ createClient: vi.fn() }));

const ID = '0b5c9a52-6f1e-4c55-9d8e-0d1f6c2a7b11';
const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const session = { userId: ME, username: 'me', isAdmin: false, mustChangePin: false, expiresAt: new Date() };
const activity = {
  id: ID, authorId: 'someone', content: '제 7회 방탈출\n• 테마', tags: ['방탈출'],
  activityDate: '2026-07-31', seasonId: 4, images: [{ id: 'i1', storagePath: 's4/a/0.jpg', position: 0 }],
};
const page = async () => render(await EditPostPage({ params: Promise.resolve({ id: ID }) }));

describe('게시글 수정 페이지', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(getAdminUser).mockResolvedValue(null);
    vi.mocked(db.query.posts.findFirst).mockResolvedValue(activity as never);
    vi.mocked(db.query.seasons.findMany).mockResolvedValue([{ id: 4, name: '시즌 4' }] as never);
    vi.mocked(createSignedPhotoUrls).mockResolvedValue(['https://signed/0']);
  });

  it('작성자도 관리자도 아니면 피드로 돌려보낸다', async () => {
    await expect(page()).rejects.toThrow('REDIRECT /');
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('관리자는 남의 글을 고칠 수 있고, 기존 사진은 signed URL로 미리 보며, 선택 정보가 채워진다', async () => {
    vi.mocked(getAdminUser).mockResolvedValueOnce({ id: ME, isAdmin: true } as never);
    await page();
    expect(createSignedPhotoUrls).toHaveBeenCalledWith(['s4/a/0.jpg']);
    expect(screen.getByRole('img', { name: '기존 사진 1' })).toHaveAttribute('src', 'https://signed/0');
    expect(screen.getByRole('button', { name: '#방탈출 빼기' })).toBeInTheDocument();
    expect(screen.getByLabelText(/모임 날짜/)).toHaveValue('2026-07-31');
    expect(screen.getByText('게시글 수정')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '@/db';
import AboutPage from './page';

vi.mock('@/db', () => ({ db: { query: { documents: { findFirst: vi.fn() } } } }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

const page = async (slug: string) => render(await AboutPage({ params: Promise.resolve({ slug }) }));

describe('AboutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.query.documents.findFirst).mockResolvedValue({
      slug: 'rules', title: '회칙👑', bodyMd: '## 제1조\n- **회비** 없음', updatedAt: new Date('2026-10-15'),
    } as never);
  });

  it('문서 제목과 Markdown 본문을 보여준다', async () => {
    await page('rules');
    expect(screen.getByRole('heading', { level: 1, name: '회칙👑' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '제1조' })).toBeInTheDocument();
    expect(screen.getByText('회비').tagName).toBe('STRONG');
  });

  it('두 문서를 탭으로 오가고 현재 문서를 표시', async () => {
    await page('rules');
    expect(screen.getByRole('link', { name: '회칙' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '공용 보관함 안내' })).toHaveAttribute('href', '/about/shared-cabinet');
  });

  it('정해진 문서가 아니면 DB 조회 없이 notFound', async () => {
    await expect(page('secret')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(db.query.documents.findFirst).not.toHaveBeenCalled();
  });

  it('DB에 문서가 없으면 notFound', async () => {
    vi.mocked(db.query.documents.findFirst).mockResolvedValueOnce(undefined as never);
    await expect(page('shared-cabinet')).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

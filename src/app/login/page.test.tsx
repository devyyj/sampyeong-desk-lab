import { describe, it, expect, vi } from 'vitest';
import { Suspense } from 'react';
import { render, act, screen } from '@testing-library/react';
import LoginPage from './page';

// 서버 액션 모듈은 DB 연결을 import하므로 렌더링 테스트에서는 대체한다.
vi.mock('@/app/actions/auth', () => ({ login: vi.fn() }));

// Next 16에서 page의 searchParams는 Promise로 전달된다.
async function renderWithSearchParams(params: { redirect?: string }) {
  let container!: HTMLElement;
  await act(async () => {
    ({ container } = render(
      <Suspense fallback={null}>
        <LoginPage searchParams={Promise.resolve(params)} />
      </Suspense>,
    ));
  });
  return container.querySelector<HTMLInputElement>('input[name="redirect"]')!;
}

describe('LoginPage', () => {
  it('URL의 redirect 값을 로그인 폼의 hidden 필드로 전달', async () => {
    const input = await renderWithSearchParams({ redirect: '/mypage' });
    expect(input.value).toBe('/mypage');
  });

  it('redirect가 없으면 / 로 기본값', async () => {
    const input = await renderWithSearchParams({});
    expect(input.value).toBe('/');
  });

  it('회원가입 링크 대신 관리자 문의 안내', async () => {
    await renderWithSearchParams({});
    expect(screen.queryByText('회원가입')).not.toBeInTheDocument();
    expect(screen.getByText('계정은 관리자에게 문의하세요.')).toBeInTheDocument();
  });
});

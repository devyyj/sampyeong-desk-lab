import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GNB from './GNB';

// Mock Next.js hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('GNB component', () => {
  it('renders login and signup links when not logged in', () => {
    render(<GNB isLoggedIn={false} />);
    
    expect(screen.getByText('로그인')).toBeInTheDocument();
    expect(screen.getByText('회원가입')).toBeInTheDocument();
    expect(screen.queryByText('마이페이지')).not.toBeInTheDocument();
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument();
  });

  it('renders mypage and logout button when logged in', () => {
    render(<GNB isLoggedIn={true} />);
    
    expect(screen.queryByText('로그인')).not.toBeInTheDocument();
    expect(screen.queryByText('회원가입')).not.toBeInTheDocument();
    expect(screen.getByText('마이페이지')).toBeInTheDocument();
    expect(screen.getByText('로그아웃')).toBeInTheDocument();
  });

  it('renders common navigation links', () => {
    render(<GNB isLoggedIn={false} />);
    
    expect(screen.getByText('자유게시판')).toBeInTheDocument();
    expect(screen.getByText('보드게임 현황')).toBeInTheDocument();
    expect(screen.getByText('회원 목록')).toBeInTheDocument();
  });
});

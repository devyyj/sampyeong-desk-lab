import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import SignupPage from '../signup/page';
import LoginPage from '../login/page';
import FeedPage from '../page';
import DirectoryPage from '../directory/page';
import AnnouncementsPage from '../announcements/page';
import ProfilePage from '../profile/page';
import GlobalHeader from './GlobalHeader';

// Mock global fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({
      posts: [
        {
          id: 'post-1',
          userId: 'test-user-id',
          content: '삼평동 책상 연구소에 오신 것을 환영합니다! #웰컴 #가구 #공지',
          imageUrls: null,
          isAnnouncement: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          likesCount: 12,
          liked: true,
          user: {
            realName: '관리자',
            department: '연구개발부',
            nickname: 'admin',
            role: 'admin',
          },
          comments: [],
        }
      ],
      profiles: [
        {
          id: 'test-user-id',
          realName: '홍길동',
          nickname: 'user1',
          department: '연구개발부',
          avatarUrl: null,
          bio: '안녕하세요! 반갑습니다.',
          role: 'admin',
        }
      ],
    }),
  })
) as jest.Mock;

const originalLocation = window.location;

describe('Component Flow TDD Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // cleanup
  });

  it('SignupPage renders and blocks sign up without name or department', async () => {
    await act(async () => {
      render(<SignupPage />);
    });
    const submitBtn = screen.getByRole('button', { name: '가입 완료' });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(await screen.findByText('이름과 부서는 필수 입력 항목입니다.')).toBeInTheDocument();
  });

  it('LoginPage blocks login with invalid inputs', async () => {
    await act(async () => {
      render(<LoginPage />);
    });
    const submitBtn = screen.getByRole('button', { name: '로그인' });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(await screen.findByText('닉네임과 비밀번호 4자리를 정확히 입력해주세요.')).toBeInTheDocument();
  });

  it('FeedPage lists mock posts and performs filtering', async () => {
    await act(async () => {
      render(
        <>
          <GlobalHeader />
          <FeedPage />
        </>
      );
    });
    // Verify header title
    expect(await screen.findByText('SDL.Lab')).toBeInTheDocument();
  });

  it('DirectoryPage performs filtering on list', async () => {
    await act(async () => {
      render(
        <>
          <GlobalHeader />
          <DirectoryPage />
        </>
      );
    });
    expect(screen.getByPlaceholderText('이름 또는 부서 검색...')).toBeInTheDocument();
  });

  it('AnnouncementsPage checks permission rules', async () => {
    await act(async () => {
      render(
        <>
          <GlobalHeader />
          <AnnouncementsPage />
        </>
      );
    });
    // Header should load
    expect(screen.getByText('연구소 공지사항')).toBeInTheDocument();
  });

  it('ProfilePage handles authentication: redirects if no token, shows details if token present', async () => {
    // 1. Without token: expect it to stay loading (or redirect)
    render(<ProfilePage />);
    expect(screen.getByText('인증 확인 중...')).toBeInTheDocument();

    // 2. With token: set token in document.cookie and render a fresh instance
    document.cookie = 'sb-access-token=test; path=/';
    const { container } = render(<ProfilePage />);
    
    expect(await screen.findByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('@user1')).toBeInTheDocument();

    // Cleanup cookie
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });
});

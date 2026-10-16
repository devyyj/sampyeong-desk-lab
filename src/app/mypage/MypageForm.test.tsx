import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MypageForm from './MypageForm';

// 서버 액션 모듈은 DB 연결을 import하므로 렌더링 테스트에서는 대체한다.
vi.mock('@/app/actions/mypage', () => ({ updateProfile: vi.fn() }));

const user = { username: 'youngyong.jo', nickname: '보드왕', department: '개발팀', bio: '', profileImageUrl: null };

describe('MypageForm', () => {
  beforeEach(() => {
    // jsdom에는 URL.createObjectURL이 없어서 미리보기 URL 생성을 대체한다.
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  it('프로필 사진 영역이 파일 입력의 label이라 사진을 눌러도 파일 선택이 열린다', () => {
    render(<MypageForm user={user} />);
    const input = screen.getByLabelText('프로필 사진 변경');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('name', 'profileImage');
  });

  it('사진을 고르면 프로필 영역에 미리보기를 보여준다', () => {
    render(<MypageForm user={user} />);
    const input = screen.getByLabelText('프로필 사진 변경');
    const file = new File(['x'], 'me.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByAltText('Profile')).toHaveAttribute('src', 'blob:preview');
  });

  it('닉네임은 필수 입력(2~20자)이고 현재 값이 채워져 있다', () => {
    render(<MypageForm user={user} />);
    const nickname = screen.getByLabelText(/닉네임/);
    expect(nickname).toHaveAttribute('name', 'nickname');
    expect(nickname).toHaveValue('보드왕');
    expect(nickname).toBeRequired();
    expect(nickname).toHaveAttribute('minLength', '2');
    expect(nickname).toHaveAttribute('maxLength', '20');
  });

  it('아이디는 로그인 아이디로 읽기 전용 표시만 하고 폼으로 보내지 않는다', () => {
    render(<MypageForm user={user} />);
    const loginId = screen.getByLabelText('로그인 아이디');
    expect(loginId).toHaveValue('youngyong.jo');
    expect(loginId).toBeDisabled();
    expect(loginId).not.toHaveAttribute('name');
  });

  it('사진이 없으면 아이디가 아닌 닉네임 첫 글자를 보여준다', () => {
    render(<MypageForm user={user} />);
    expect(screen.queryByText('Y')).toBeNull();
    expect(screen.getByText('보')).toBeInTheDocument();
  });
});

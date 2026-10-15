import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChangePinPage from './page';

// 서버 액션 모듈은 DB 연결을 import하므로 렌더링 테스트에서는 대체한다.
vi.mock('@/app/actions/auth', () => ({ changePin: vi.fn() }));

describe('ChangePinPage', () => {
  it('안내 문구와 새 PIN·확인 입력란을 렌더링', () => {
    const { container } = render(<ChangePinPage />);
    expect(screen.getByText('초기 비밀번호를 변경해주세요')).toBeInTheDocument();
    expect(container.querySelector('input[name="newPin"]')).toHaveAttribute('maxLength', '4');
    expect(container.querySelector('input[name="confirmNewPin"]')).toHaveAttribute('maxLength', '4');
  });
});

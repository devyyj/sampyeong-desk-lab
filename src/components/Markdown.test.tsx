import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Markdown from './Markdown';

describe('Markdown', () => {
  it('Confluence에서 옮긴 중첩 목록과 굵은 글씨를 렌더링', () => {
    const { container } = render(<Markdown>{'- 정기 모임\n- **인원 : 15명**\n    - 워드캡쳐'}</Markdown>);
    expect(screen.getByText('정기 모임')).toBeInTheDocument();
    expect(screen.getByText('인원 : 15명').tagName).toBe('STRONG');
    expect(container.querySelectorAll('ul ul li')).toHaveLength(1);
  });

  it('표(GFM)를 렌더링', () => {
    render(<Markdown>{'| 이름 | 인원 |\n| --- | --- |\n| 스컬킹 | 2~8 |'}</Markdown>);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('본문 속 HTML은 실행하지 않는다(XSS 방지)', () => {
    const { container } = render(<Markdown>{'<img src=x onerror="alert(1)"><script>alert(1)</script>'}</Markdown>);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});

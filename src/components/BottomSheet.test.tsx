import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import BottomSheet from './BottomSheet';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>열기</button>
      <BottomSheet open={open} title="카테고리" onClose={() => setOpen(false)}>
        <button type="button">첫째</button>
        <button type="button">둘째</button>
      </BottomSheet>
    </>
  );
}

describe('BottomSheet', () => {
  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    render(<BottomSheet open={false} title="t" onClose={() => {}}>내용</BottomSheet>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('열리면 제목을 이름으로 가진 모달 대화상자', () => {
    render(<BottomSheet open title="카테고리" onClose={() => {}}>내용</BottomSheet>);
    const dialog = screen.getByRole('dialog', { name: '카테고리' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('내용');
  });

  it('ESC, 닫기 버튼, 배경을 누르면 onClose', () => {
    const onClose = vi.fn();
    render(<BottomSheet open title="t" onClose={onClose}>내용</BottomSheet>);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('시트 안쪽을 눌러도 닫히지 않는다', () => {
    const onClose = vi.fn();
    render(<BottomSheet open title="t" onClose={onClose}><p>안쪽</p></BottomSheet>);
    fireEvent.click(screen.getByText('안쪽'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('열면 포커스가 시트 안으로 들어가고, 닫으면 연 버튼으로 돌아온다', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: '열기' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Tab은 시트 안에서만 돈다(포커스 트랩)', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    const last = screen.getByRole('button', { name: '둘째' });
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    // 마지막에서 Tab → 시트의 첫 요소(닫기 버튼)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '닫기' }));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});

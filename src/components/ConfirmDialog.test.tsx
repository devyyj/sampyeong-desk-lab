import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { useConfirm } from './ConfirmDialog';
import BottomSheet from './BottomSheet';

/** 버튼을 누르면 확인 팝업을 띄우고, 고른 결과를 화면에 적는 테스트용 컴포넌트 */
function Harness({ alertOnly = false }: { alertOnly?: boolean }) {
  const [confirm, dialog] = useConfirm();
  const [result, setResult] = useState('없음');
  return (
    <>
      <button
        type="button"
        onClick={async () =>
          setResult(String(await confirm({ title: '게시글을 삭제할까요?', message: '되돌릴 수 없어요.', confirmLabel: '삭제', danger: true, alertOnly })))
        }
      >
        열기
      </button>
      <p data-testid="result">{result}</p>
      {dialog}
    </>
  );
}

describe('useConfirm / ConfirmDialog', () => {
  it('브라우저 confirm 대신 앱 안의 alertdialog를 띄운다(제목·설명·취소·확인 버튼)', () => {
    const spy = vi.spyOn(window, 'confirm');
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    const dialog = screen.getByRole('alertdialog', { name: '게시글을 삭제할까요?' });
    expect(dialog).toHaveTextContent('되돌릴 수 없어요.');
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('위험한 동작은 실수로 확정하지 않게 처음 포커스가 취소 버튼에 간다', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
  });

  it('확인을 누르면 true로 끝나고 팝업이 닫힌다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '삭제' })));
    expect(screen.getByTestId('result')).toHaveTextContent('true');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('취소·ESC·배경을 누르면 false로 끝난다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '취소' })));
    expect(screen.getByTestId('result')).toHaveTextContent('false');

    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    await act(async () => fireEvent.keyDown(document, { key: 'Escape' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByTestId('result')).toHaveTextContent('false');

    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    await act(async () => fireEvent.click(screen.getByRole('alertdialog')));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('alertOnly: 확인 버튼 하나만 있는 안내 팝업(브라우저 alert 대신)', async () => {
    render(<Harness alertOnly />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    expect(screen.queryByRole('button', { name: '취소' })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '삭제' })));
    expect(screen.getByTestId('result')).toHaveTextContent('true');
  });

  it('시트 위에 겹쳐 뜬 경우 ESC는 맨 위 팝업만 닫는다', async () => {
    function SheetHarness() {
      const [confirm, dialog] = useConfirm();
      return (
        <BottomSheet open title="게시글" onClose={() => {}}>
          <button type="button" onClick={() => confirm({ title: '삭제할까요?' })}>
            삭제
          </button>
          {dialog}
        </BottomSheet>
      );
    }
    render(<SheetHarness />);
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await act(async () => fireEvent.keyDown(document, { key: 'Escape' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('dialog', { name: '게시글' })).toBeInTheDocument();
  });
});

'use client';

import React from 'react';

interface VirtualKeypadProps {
  onInput: (value: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onClose?: () => void;
}

export default function VirtualKeypad({ onInput, onDelete, onClear, onClose }: VirtualKeypadProps) {
  const [digits] = React.useState<number[]>(() => {
    const arr = Array.from({ length: 10 }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  return (
    <div 
      className="p-3 bg-white dark:bg-[#121214] border border-[#e4e4e7] dark:border-[#27272a] rounded-lg max-w-[240px] mx-auto shadow-sm"
      data-testid="virtual-keypad"
    >
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-[10px] font-semibold text-[#71717a] dark:text-[#a1a1aa] tracking-wider">보안 키패드</span>
        {onClose && (
          <button 
            type="button"
            onClick={onClose} 
            className="text-[10px] text-rose-500 hover:underline"
          >
            닫기
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {digits.slice(0, 9).map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onInput(num.toString())}
            className="h-9 text-[13px] font-semibold bg-[#fafafa] dark:bg-[#18181b] hover:bg-[#f4f4f5] dark:hover:bg-[#27272a] rounded border border-[#e4e4e7] dark:border-[#27272a] transition-colors flex items-center justify-center"
          >
            {num}
          </button>
        ))}
        
        {/* Clear Button */}
        <button
          type="button"
          onClick={onClear}
          className="h-9 text-[10px] font-semibold bg-transparent hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded border border-rose-200 dark:border-rose-950 transition-colors flex items-center justify-center"
        >
          지우기
        </button>

        {/* 10th number */}
        {digits[9] !== undefined && (
          <button
            type="button"
            onClick={() => onInput(digits[9].toString())}
            className="h-9 text-[13px] font-semibold bg-[#fafafa] dark:bg-[#18181b] hover:bg-[#f4f4f5] dark:hover:bg-[#27272a] rounded border border-[#e4e4e7] dark:border-[#27272a] transition-colors flex items-center justify-center"
          >
            {digits[9]}
          </button>
        )}

        {/* Backspace Button */}
        <button
          type="button"
          onClick={onDelete}
          className="h-9 text-[10px] font-semibold bg-transparent hover:bg-[#f4f4f5] dark:hover:bg-[#27272a] text-[#71717a] dark:text-[#a1a1aa] rounded border border-[#e4e4e7] dark:border-[#27272a] transition-colors flex items-center justify-center"
        >
          취소
        </button>
      </div>
    </div>
  );
}

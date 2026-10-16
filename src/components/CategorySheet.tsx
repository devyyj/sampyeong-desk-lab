'use client';

import Link from 'next/link';
import { useState } from 'react';
import { chipClass } from '@/lib/chip';
import BottomSheet from './BottomSheet';
import { ChevronDownIcon } from './icons';

export type CategoryLink = { label: string; count: number; href: string; active: boolean };

/**
 * 보드게임 필터 줄의 "카테고리 ▾" 칩과, 누르면 올라오는 카테고리 선택 시트.
 * 카테고리가 30여 개라 칩으로 다 늘어놓으면 첫 화면을 덮어서 시트 안으로 옮겼다.
 * 링크 주소(검색어 유지 등)와 정렬은 서버(page)가 정해 넘긴다. 고른 카테고리가 있으면 칩에 그 이름을 보여준다.
 */
export default function CategorySheet({ categories }: { categories: CategoryLink[] }) {
  const [open, setOpen] = useState(false);
  const current = categories.find((c) => c.active);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={current ? `카테고리: ${current.label}` : '카테고리'}
        onClick={() => setOpen(true)}
        className={`${chipClass(Boolean(current))} inline-flex items-center gap-1`}
      >
        {current ? current.label : '카테고리'}
        <ChevronDownIcon size={14} strokeWidth={2.2} />
      </button>
      <BottomSheet open={open} title="카테고리" onClose={() => setOpen(false)}>
        <ul className="flex flex-wrap gap-2 pt-1">
          {categories.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                aria-current={c.active ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={chipClass(c.active)}
              >
                {`${c.label} ${c.count}`}
              </Link>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}

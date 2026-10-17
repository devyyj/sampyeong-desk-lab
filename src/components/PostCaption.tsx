'use client';

import { useState } from 'react';

const CLAMP_LINES = 3;
const CLAMP_CHARS = 140;

/**
 * 접어야 할 만큼 긴 글인지. 실제 렌더 높이를 재면 서버 렌더와 첫 화면이 어긋나므로(깜빡임),
 * 줄 수·글자 수로 미리 판단한다. 140자는 모바일 폭에서 대략 3줄을 넘는 길이다.
 */
export function needsClamp(content: string): boolean {
  return content.split('\n').length > CLAMP_LINES || content.length > CLAMP_CHARS;
}

/**
 * 피드 본문. 긴 글은 3줄로 접고 "더 보기"로 펼친다(한 번 펼치면 다시 접지 않음 — 인스타그램과 같은 동작).
 * 사진 없는 글은 본문이 카드의 주인공이라 글씨를 키운다(large).
 */
export default function PostCaption({ content, large = false }: { content: string; large?: boolean }) {
  const clampable = needsClamp(content);
  const [expanded, setExpanded] = useState(false);
  const clamped = clampable && !expanded;

  return (
    <div>
      <p
        className={`whitespace-pre-wrap break-words ${large ? 'text-[18px] leading-relaxed' : 'text-[16px] leading-normal'} ${
          clamped ? 'line-clamp-3' : ''
        }`}
      >
        {content}
      </p>
      {/* "더 보기"는 오른쪽 끝에 둔다(왼쪽에 있으면 본문의 다음 줄처럼 읽혀 버튼인지 알아보기 어려웠다). */}
      {clamped && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setExpanded(true)} className="mt-0.5 text-[16px] font-medium text-muted-foreground hover:text-foreground">
            더 보기
          </button>
        </div>
      )}
    </div>
  );
}

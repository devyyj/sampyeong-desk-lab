// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { TABS, activeTabOf, hidesAppChrome } from './nav';

describe('TABS', () => {
  it('하단 탭 5개를 순서대로 둔다', () => {
    expect(TABS.map((t) => [t.label, t.href])).toEqual([
      ['피드', '/'],
      ['활동', '/activities'],
      ['보드게임', '/boardgames'],
      ['회원', '/members'],
      ['MY', '/my'],
    ]);
  });
});

describe('activeTabOf', () => {
  it.each([
    ['/', '/'],
    // 하위 경로도 상위 탭을 현재 탭으로 본다. '/'는 모든 경로의 접두사라 정확히 일치할 때만 피드다.
    ['/activities', '/activities'],
    ['/activities/abc', '/activities'],
    ['/boardgames/add', '/boardgames'],
    ['/boardgames/x/edit', '/boardgames'],
    ['/members', '/members'],
    // MY에서 들어가는 화면(프로필 편집·동호회 안내·관리자·PIN 변경)은 MY 탭에 속한다.
    ['/my', '/my'],
    ['/mypage', '/my'],
    ['/about/rules', '/my'],
    ['/admin/members', '/my'],
    ['/change-pin', '/my'],
    // 게시글 작성·수정은 피드에서 이어지는 화면이다.
    ['/posts/write', '/'],
    ['/posts/abc/edit', '/'],
    // 어떤 탭에도 속하지 않는 화면
    ['/login', null],
    ['/activitiesX', null],
  ])('%s → %s', (pathname, expected) => {
    expect(activeTabOf(pathname)?.href ?? null).toBe(expected);
  });
});

describe('hidesAppChrome', () => {
  it.each([
    // 작성 화면은 키보드·본문 입력에 집중하도록 탭바를 숨긴다.
    ['/posts/write', true],
    ['/posts/abc/edit', true],
    ['/', false],
    ['/activities/abc', false],
    ['/mypage', false],
  ])('%s → %s', (pathname, expected) => {
    expect(hidesAppChrome(pathname)).toBe(expected);
  });
});

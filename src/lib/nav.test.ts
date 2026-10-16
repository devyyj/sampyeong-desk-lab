// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { TABS, activeTabOf, hidesAppChrome, createActionFor } from './nav';

describe('TABS', () => {
  it('하단 탭 4개를 순서대로 둔다(활동 기록은 피드로 합쳐짐)', () => {
    expect(TABS.map((t) => [t.label, t.href])).toEqual([
      ['피드', '/'],
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
    // 게시글 상세(자유글·활동 기록)는 피드 탭이다.
    ['/posts/abc', '/'],
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
    ['/postsX', null],
  ])('%s → %s', (pathname, expected) => {
    expect(activeTabOf(pathname)?.href ?? null).toBe(expected);
  });
});

describe('hidesAppChrome', () => {
  it.each([
    // 작성 화면은 키보드·본문 입력에 집중하도록 탭바를 숨긴다.
    ['/posts/write', true],
    ['/posts/abc/edit', true],
    // 데이터 생성·수정 화면은 모두 같은 전체 화면 폼(취소 | 제목 | 등록)을 쓴다.
    ['/boardgames/add', true],
    ['/boardgames/abc/edit', true],
    ['/members/new', true],
    ['/', false],
    ['/posts/abc', false],
    ['/mypage', false],
  ])('%s → %s', (pathname, expected) => {
    expect(hidesAppChrome(pathname)).toBe(expected);
  });
});

describe('createActionFor (탭별 ＋ 버튼)', () => {
  const guest = { isLoggedIn: false, isAdmin: false };
  const member = { isLoggedIn: true, isAdmin: false };
  const admin = { isLoggedIn: true, isAdmin: true };

  it('피드·보드게임은 회원에게 작성 화면, 비회원에게는 로그인 후 돌아오는 주소', () => {
    expect(createActionFor('/', member)).toEqual({ label: '글쓰기', href: '/posts/write' });
    expect(createActionFor('/boardgames', member)).toEqual({ label: '보드게임 등록', href: '/boardgames/add' });
    expect(createActionFor('/', guest)).toEqual({ label: '글쓰기', href: '/login?redirect=%2Fposts%2Fwrite' });
    expect(createActionFor('/boardgames', guest)).toEqual({ label: '보드게임 등록', href: '/login?redirect=%2Fboardgames%2Fadd' });
  });

  it('회원 추가는 관리자에게만(회원 탭과 회원 관리 화면 모두 같은 ＋ 버튼)', () => {
    expect(createActionFor('/members', admin)).toEqual({ label: '회원 추가', href: '/members/new' });
    expect(createActionFor('/admin/members', admin)).toEqual({ label: '회원 추가', href: '/members/new' });
    expect(createActionFor('/admin/members', member)).toBeNull();
    expect(createActionFor('/members', member)).toBeNull();
    expect(createActionFor('/members', guest)).toBeNull();
  });

  it('탭 첫 화면이 아니면 없다', () => {
    for (const path of ['/my', '/posts/abc', '/boardgames/add', '/posts/write', '/members/new', '/about/rules']) {
      expect(createActionFor(path, admin)).toBeNull();
    }
  });
});

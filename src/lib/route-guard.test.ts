// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { guardRoute } from './route-guard';

describe('guardRoute', () => {
  it.each([
    // 로그인 필요 경로 + 비로그인 → 로그인 화면(원래 경로를 redirect로 전달)
    ['/admin/members', null, '/login?redirect=%2Fadmin%2Fmembers'],
    ['/change-pin', null, '/login?redirect=%2Fchange-pin'],
    ['/mypage', null, '/login?redirect=%2Fmypage'],
    ['/posts/write', null, '/login?redirect=%2Fposts%2Fwrite'],
    // 기존 middleware가 놓치던 동적 편집 경로
    ['/posts/abc/edit', null, '/login?redirect=%2Fposts%2Fabc%2Fedit'],
    ['/boardgames/xyz/edit', null, '/login?redirect=%2Fboardgames%2Fxyz%2Fedit'],
    // 회원 명부는 로그인 화면으로 보내지 않고, 페이지가 비회원에게 '로그인해야 볼 수 있다'고 안내한다.
    ['/members', null, null],
    // 공개 경로
    ['/', null, null],
    ['/boardgames', null, null],
    ['/login', null, null],
    // 활동 기록·동호회 안내는 공개(활동 사진만 페이지에서 회원 여부로 가린다)
    ['/activities', null, null],
    ['/activities/abc', null, null],
    ['/about/rules', null, null],
    // MY 탭 허브는 비회원에게도 로그인 버튼·동호회 안내를 보여주는 공개 화면이다(/mypage 편집 화면만 보호).
    ['/my', null, null],
    // PIN 변경 필요 → 어떤 페이지든 /change-pin
    ['/', { mustChangePin: true }, '/change-pin'],
    ['/boardgames', { mustChangePin: true }, '/change-pin'],
    ['/admin/members', { mustChangePin: true }, '/change-pin'],
    ['/posts/abc/edit', { mustChangePin: true }, '/change-pin'],
    ['/change-pin', { mustChangePin: true }, null],
    // PIN 변경이 필요 없는데 /change-pin → 홈
    ['/change-pin', { mustChangePin: false }, '/'],
    ['/mypage', { mustChangePin: false }, null],
  ] as const)('guardRoute(%s, %o) → %s', (path, session, expected) => {
    expect(guardRoute(path, session)).toBe(expected);
  });
});

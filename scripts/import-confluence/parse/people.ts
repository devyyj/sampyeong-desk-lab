import type { Mention, Person } from '../types';

/**
 * 사용자 멘션 링크(<a class="confluence-userlink" data-username>)를 해석한다.
 * - 사내 ID는 링크 텍스트가 아니라 data-username에서 가져온다(텍스트는 표시명이라 바뀔 수 있음).
 * - 링크 텍스트는 "이름/부서" 형식이다. 부서명에 "/"가 들어갈 가능성을 고려해 첫 "/"에서만 나눈다.
 * - 퇴사 등으로 계정이 사라진 사용자는 "Unknown User (id)"로 렌더링된다.
 */
export function parseMention(a: Element): Mention {
  const username = a.getAttribute('data-username') ?? '';
  const text = (a.textContent ?? '').trim();
  if (text.startsWith('Unknown User')) {
    return { username, displayName: null, department: null, unknown: true };
  }
  const slash = text.indexOf('/');
  return slash < 0
    ? { username, displayName: text, department: null, unknown: false }
    : { username, displayName: text.slice(0, slash).trim(), department: text.slice(slash + 1).trim(), unknown: false };
}

/**
 * 여러 페이지에서 모은 멘션을 사람 목록으로 합친다.
 * 같은 사람이 시즌마다 다른 부서로 적혀 있을 수 있어(부서 이동), 호출하는 쪽이 최신 정보부터 넘기고
 * 여기서는 먼저 나온 값을 채택한다. Unknown User는 이관하지 않는다.
 */
export function collectPeople(mentionsInPriorityOrder: Mention[]): Person[] {
  const byUsername = new Map<string, Person>();
  for (const m of mentionsInPriorityOrder) {
    if (m.unknown || byUsername.has(m.username)) continue;
    // users.department는 NOT NULL이라 부서 표기가 없는 경우 빈 문자열로 둔다.
    byUsername.set(m.username, { username: m.username, displayName: m.displayName ?? m.username, department: m.department ?? '' });
  }
  return [...byUsername.values()];
}

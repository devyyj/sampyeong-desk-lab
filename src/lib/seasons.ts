/**
 * URL의 ?season= 값을 실제 시즌으로 바꾼다.
 * 시즌 탭은 링크로만 이동하지만, 사용자가 주소를 직접 고치거나 오래된 링크를 열 수 있으므로
 * 값이 없거나 숫자가 아니거나 존재하지 않는 시즌이면 오류 대신 가장 최근 시즌을 보여준다.
 * "가장 최근"은 id가 가장 큰 시즌이다(시즌 번호 순으로 id를 부여해 이관했다).
 */
export function resolveSeason<T extends { id: number }>(
  param: string | string[] | undefined,
  seasons: T[],
): T | null {
  if (seasons.length === 0) return null;
  const latest = seasons.reduce((a, b) => (b.id > a.id ? b : a));
  // ?season=1&season=2 처럼 같은 키가 여러 번 오면 Next는 배열을 넘긴다.
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw || !/^\d+$/.test(raw)) return latest;
  return seasons.find((s) => s.id === Number(raw)) ?? latest;
}

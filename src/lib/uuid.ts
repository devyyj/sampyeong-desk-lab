// uuid 컬럼을 형식이 다른 값으로 조회하면 Postgres가 캐스팅 오류(500)를 낸다.
// Server Action·동적 경로는 누구나 임의 값으로 호출할 수 있으므로 조회 전에 형식을 먼저 확인한다.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

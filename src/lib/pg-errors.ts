// Postgres 오류 코드 판별. Drizzle은 postgres 드라이버 오류를 `cause`에 담아 다시 던지므로 둘 다 본다.
const codeOf = (e: unknown): unknown => {
  if (typeof e !== 'object' || e === null) return undefined;
  const { code, cause } = e as { code?: unknown; cause?: unknown };
  return code ?? (typeof cause === 'object' && cause !== null ? (cause as { code?: unknown }).code : undefined);
};

/** 고유 제약 위반(23505): 닉네임 중복 등 */
export const isUniqueViolation = (e: unknown) => codeOf(e) === '23505';

/** 외래 키 위반(23503): 좋아요·댓글을 다는 사이 대상이 삭제된 경우 등 */
export const isForeignKeyViolation = (e: unknown) => codeOf(e) === '23503';

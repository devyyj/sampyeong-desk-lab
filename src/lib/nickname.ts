export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20; // users.nickname varchar(20)
export const NICKNAME_LENGTH_ERROR = `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해주세요.`;
export const NICKNAME_TAKEN = '이미 사용 중인 닉네임입니다.';

/**
 * 닉네임 입력값을 검증한다. 앞뒤 공백은 저장하면 같은 닉네임이 다르게 보이므로 제거한다.
 * 길이는 Postgres varchar처럼 글자(코드 포인트) 수로 센다. JS length는 이모지를 2로 세서 DB 기준과 어긋난다.
 * 중복 여부는 여기서 보지 않는다. DB의 lower(nickname) 고유 인덱스가 최종 판정하고, 액션이 23505를 문구로 바꾼다.
 */
export function validateNickname(raw: string): { ok: true; nickname: string } | { ok: false; error: string } {
  const nickname = raw.trim();
  const length = [...nickname].length;
  if (length < NICKNAME_MIN || length > NICKNAME_MAX) return { ok: false, error: NICKNAME_LENGTH_ERROR };
  return { ok: true, nickname };
}

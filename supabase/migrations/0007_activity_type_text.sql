-- 활동 종류를 자유 입력으로 바꾼다: posts.activity_type에 코드(ESCAPE_ROOM 등) 대신 화면 이름(방탈출 등)을 저장한다.
-- 회원이 "보드게임 카페", "번개"처럼 정해진 목록에 없는 종류를 직접 입력할 수 있게 하기 위함이다(src/lib/activity-types.ts).
-- 손으로 작성한 마이그레이션이다. 공유 운영 DB에 적용되므로 사용자 확인 후 적용한다.
-- 칼럼 타입(varchar(20))·제약은 그대로이고 값만 바꾼다. 앱은 적용 전에도 예전 코드를 이름으로 바꿔 보여주므로 순서에 민감하지 않다.
-- (예전 설계의 "0007 정리 마이그레이션"은 0008로 미룬다.)

UPDATE "posts"
SET "activity_type" = CASE "activity_type"
  WHEN 'ESCAPE_ROOM' THEN '방탈출'
  WHEN 'REGULAR' THEN '정기 모임'
  WHEN 'LUNCH' THEN '점심'
  WHEN 'EVENING' THEN '저녁'
  WHEN 'OTHER' THEN '기타'
END
WHERE "kind" = 'activity' AND "activity_type" IN ('ESCAPE_ROOM', 'REGULAR', 'LUNCH', 'EVENING', 'OTHER');

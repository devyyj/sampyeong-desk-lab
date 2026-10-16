-- 보드게임 카테고리 표기 통일 (1회성 데이터 정리)
--
-- Confluence 보관함 표에서 사람마다 다르게 적은 카테고리가 그대로 이관되어,
-- 같은 분류가 여러 필터로 갈라져 보였다(/boardgames 카테고리 필터).
-- 표기만 다른 것끼리만 합치고, 의미가 다른 분류('협동 전략', '주사위 마피아' 등)는 그대로 둔다.
-- 현재 앱의 보드게임 등록/수정 화면에는 카테고리 입력이 없으므로, 정리 후 다시 갈라지지 않는다.
-- 여러 번 실행해도 결과가 같다(멱등).
UPDATE "board_games" SET "category" = '카드 게임' WHERE "category" = '카드게임';
UPDATE "board_games" SET "category" = '마피아' WHERE "category" = '마피아 게임';
UPDATE "board_games" SET "category" = '협동' WHERE "category" = '협력게임';

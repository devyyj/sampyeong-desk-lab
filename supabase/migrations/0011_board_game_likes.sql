-- 보드게임 좋아요. 보드게임 목록을 좋아요 많은 순으로 보여주는 데 쓴다.
-- post_likes·comment_likes(0005)와 같은 구조: (게임, 회원) 복합 PK로 회원당 1회, 게임·회원이 지워지면 함께 지운다.
-- 손으로 작성한 마이그레이션이다(drizzle/schema.ts의 boardGameLikes와 같은 구조). 테이블 추가만 하므로 기존 데이터는 건드리지 않는다.
-- 순서: 이 테이블을 읽는 새 앱보다 먼저 적용해야 한다(없으면 /boardgames 조회가 실패한다).
CREATE TABLE IF NOT EXISTS "board_game_likes" (
  "board_game_id" uuid NOT NULL REFERENCES "board_games"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "board_game_likes_board_game_id_user_id_pk" PRIMARY KEY ("board_game_id", "user_id")
);

-- 다른 좋아요 테이블과 같이 RLS를 켜 두고 정책은 두지 않는다. 앱은 서버(DATABASE_URL, postgres 역할)로만 읽고 쓰므로
-- 브라우저에 공개된 publishable 키로는 이 테이블에 접근할 수 없다.
ALTER TABLE "board_game_likes" ENABLE ROW LEVEL SECURITY;

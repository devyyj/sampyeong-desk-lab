CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" integer NOT NULL,
	"date" date NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"note_md" text,
	"source_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activities_source_key_unique" UNIQUE("source_key")
);
--> statement-breakpoint
CREATE TABLE "activity_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "activity_photos_activity_id_position_unique" UNIQUE("activity_id","position")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"slug" varchar(50) PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"source_page_id" varchar(20),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_members" (
	"season_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(50),
	"note" text,
	CONSTRAINT "season_members_season_id_user_id_pk" PRIMARY KEY("season_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"period" varchar(50) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "pin_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "board_games" ADD COLUMN "category" varchar(50);--> statement-breakpoint
ALTER TABLE "board_games" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "board_games" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "board_games" ADD COLUMN "in_shared_cabinet" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board_games" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" varchar(50);--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_photos" ADD CONSTRAINT "activity_photos_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_members" ADD CONSTRAINT "season_members_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_members" ADD CONSTRAINT "season_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_games" ADD CONSTRAINT "board_games_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_games" ADD CONSTRAINT "board_games_source_key_unique" UNIQUE("source_key");
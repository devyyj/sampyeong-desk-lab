-- Enable Row Level Security
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "board_games" ENABLE ROW LEVEL SECURITY;

-- Allow public read access to tables (since unauthenticated users can read everything)
CREATE POLICY "Allow public read users" ON "users" FOR SELECT USING (true);
CREATE POLICY "Allow public read posts" ON "posts" FOR SELECT USING (true);
CREATE POLICY "Allow public read board_games" ON "board_games" FOR SELECT USING (true);

-- Storage Buckets Setup
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('post_images', 'post_images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('boardgame_thumbnails', 'boardgame_thumbnails', true);

-- Storage Public Read Policies
CREATE POLICY "Public Access avatars" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );
CREATE POLICY "Public Access post_images" ON storage.objects FOR SELECT USING ( bucket_id = 'post_images' );
CREATE POLICY "Public Access boardgame_thumbnails" ON storage.objects FOR SELECT USING ( bucket_id = 'boardgame_thumbnails' );

-- Note: Insert/Update/Delete will be handled via Next.js Server Actions using the Supabase Service Role key, 
-- because we are implementing a custom 4-digit PIN auth system bypassing Supabase native Auth.

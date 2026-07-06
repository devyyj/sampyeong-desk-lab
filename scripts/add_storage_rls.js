import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  try {
    // Add INSERT policy for anonymous users for the buckets
    await sql`
      CREATE POLICY "Allow anonymous inserts avatars" 
      ON storage.objects FOR INSERT 
      WITH CHECK (bucket_id = 'avatars');
    `;
    console.log("Added insert policy for avatars");
  } catch(e) { console.error(e.message) }

  try {
    await sql`
      CREATE POLICY "Allow anonymous inserts post_images" 
      ON storage.objects FOR INSERT 
      WITH CHECK (bucket_id = 'post_images');
    `;
    console.log("Added insert policy for post_images");
  } catch(e) { console.error(e.message) }

  try {
    await sql`
      CREATE POLICY "Allow anonymous inserts boardgame_thumbnails" 
      ON storage.objects FOR INSERT 
      WITH CHECK (bucket_id = 'boardgame_thumbnails');
    `;
    console.log("Added insert policy for boardgame_thumbnails");
  } catch(e) { console.error(e.message) }

  process.exit(0);
}

main();

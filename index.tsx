import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { users } from './drizzle/schema'

const connectionString = process.env.DATABASE_URL

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString!, { prepare: false })
const db = drizzle(client);

// Note: Top-level await is used here as per the instructions snippet.
// In Next.js, this is usually wrapped in a function or Server Component.
const allUsers = await db.select().from(users);

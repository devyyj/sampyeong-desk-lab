import { withSupabase } from "@supabase/server"

// Next.js App Router Route Handler using @supabase/server SDK
export const GET = withSupabase({ auth: "user" }, async (request, context) => {
  try {
    // context.supabase is the RLS-scoped client based on the user's JWT
    // context.supabaseAdmin is the admin client that bypasses RLS
    const { data, error } = await context.supabase.from("todos").select()
    
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    
    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
})

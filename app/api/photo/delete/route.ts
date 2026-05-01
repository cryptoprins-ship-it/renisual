import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
  path: z.string().regex(/^anon-uploads\/[\w-]+\.jpg$/),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_path" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await supabase.storage.from("project-photos").remove([parsed.data.path]);

  if (error) {
    console.error("[photo delete]", error);
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}

// Supabase Edge Function: now-playing
// Machine-to-machine write endpoint for the SMTC bridge.
//
// Deploy with JWT verification DISABLED (auth is our own x-push-token header):
//   supabase functions deploy now-playing --no-verify-jwt
// Set the shared secret:
//   supabase secrets set NP_PUSH_TOKEN=<a-long-random-string>
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-push-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const expected = Deno.env.get("NP_PUSH_TOKEN");
  if (!expected || req.headers.get("x-push-token") !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const handle = String(body.handle ?? "").slice(0, 64);
  if (!handle) return json({ error: "handle required" }, 400);

  const row: Record<string, unknown> = {
    handle,
    display_name: body.display_name ?? null,
    title: body.title ?? null,
    artist: body.artist ?? null,
    album: body.album ?? null,
    status: body.status ?? null,
    position_ms: body.position_ms ?? null,
    duration_ms: body.duration_ms ?? null,
    app: body.app ?? null,
    updated_at: new Date().toISOString(),
  };
  // Only overwrite the cover when one is supplied, so the bridge can send it just
  // on track change (a null/absent cover keeps whatever is already stored).
  if (typeof body.cover === "string" && body.cover) row.cover = body.cover;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await supabase.from("now_playing").upsert(row, { onConflict: "handle" });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});

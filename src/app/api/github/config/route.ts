import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");

  if (!repoId) return NextResponse.json({ error: "Repo ID is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("repo_configs")
    .select("local_path")
    .eq("repo_id", repoId)
    .eq("user_email", session.user.email)
    .single();

  if (error && error.code !== "PGRST116") { // PGRST116 is 'no rows found'
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ local_path: data?.local_path || "" });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { repoId, localPath } = body;

  const { data, error } = await supabase
    .from("repo_configs")
    .upsert({
      user_email: session.user.email,
      repo_id: String(repoId),
      local_path: localPath,
    }, { onConflict: 'user_email,repo_id' })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

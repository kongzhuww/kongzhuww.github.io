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
    .from("repo_todos")
    .select("*")
    .eq("repo_id", repoId)
    .eq("user_email", session.user.email)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ todos: data });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { repoId, task } = body;

  const { data, error } = await supabase
    .from("repo_todos")
    .insert([{ user_email: session.user.email, repo_id: String(repoId), task }])
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ todo: data[0] });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, completed } = body;

  const { error } = await supabase
    .from("repo_todos")
    .update({ completed })
    .eq("id", id)
    .eq("user_email", session.user.email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const { error } = await supabase
    .from("repo_todos")
    .delete()
    .eq("id", id)
    .eq("user_email", session.user.email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

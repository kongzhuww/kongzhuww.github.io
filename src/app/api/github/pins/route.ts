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

  console.log(`Fetching pins for repoId: ${repoId}, email: ${session.user.email}`);

  const { data, error } = await supabase
    .from("repo_pins")
    .select("*")
    .eq("repo_id", repoId)
    .eq("user_email", session.user.email);

  if (error) {
    console.error("Supabase GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`Found ${data?.length || 0} pins`);
  return NextResponse.json({ pins: data });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { repoId, repoName, pinName, pinNumber, peripheral, notes } = body;

  console.log("Saving pin:", { repoId, repoName, pinName, pinNumber, peripheral });

  const { data, error } = await supabase
    .from("repo_pins")
    .insert([
      {
        user_email: session.user.email,
        repo_id: String(repoId),
        repo_name: repoName,
        pin_name: pinName,
        pin_number: pinNumber,
        peripheral: peripheral,
        notes: notes,
      },
    ])
    .select();

  if (error) {
    console.error("Supabase POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("Pin saved successfully");
  return NextResponse.json({ pin: data[0] });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const pinId = searchParams.get("id");

  if (!pinId) return NextResponse.json({ error: "Pin ID is required" }, { status: 400 });

  const { error } = await supabase
    .from("repo_pins")
    .delete()
    .eq("id", pinId)
    .eq("user_email", session.user.email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

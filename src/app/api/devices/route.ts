import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 从 Supabase 查询属于当前用户的设备
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("user_email", session.user.email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ devices: data });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, mqtt_topic, location } = body;

  if (!name || !mqtt_topic) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 插入新设备到 Supabase
  const { data, error } = await supabase
    .from("devices")
    .insert([
      {
        user_email: session.user.email,
        name,
        mqtt_topic,
        location: location || "Unknown",
        status: "Offline",
      },
    ])
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ device: data[0] });
}

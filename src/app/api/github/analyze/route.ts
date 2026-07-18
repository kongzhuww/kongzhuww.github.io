import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

interface GitTreeItem {
  path?: string;
  type?: string;
}

interface GitTreeResponse {
  tree: GitTreeItem[];
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const accessToken = token?.accessToken as string | undefined;

  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { repoFullName, modelName } = body;

  const targetModel = modelName || "gemini-3-flash-preview";
  console.log(`Starting AI analysis for ${repoFullName} using OneAPI model ${targetModel}`);

  if (!repoFullName) return NextResponse.json({ error: "Repo name is required" }, { status: 400 });

  try {
    // 1. 获取 GitHub 仓库文件树
    const treeUrl = `https://api.github.com/repos/${repoFullName}/git/trees/main?recursive=1`;
    let treeRes = await fetch(treeUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!treeRes.ok) {
      const backupUrl = `https://api.github.com/repos/${repoFullName}/git/trees/master?recursive=1`;
      treeRes = await fetch(backupUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!treeRes.ok) throw new Error("Failed to fetch repo tree from GitHub");
    }
    
    const treeData = (await treeRes.json()) as GitTreeResponse;
    const fileList = treeData.tree
      .filter((item) => item.type === "blob")
      .map((item) => item.path)
      .join("\n");

    console.log(`Fetched ${treeData.tree.length} files from GitHub`);

    // 2. 调用 OneAPI (OpenAI 兼容接口)
    const prompt = `
      You are an expert embedded systems architect. Analyze the following file list from a GitHub repository and extract key technical info.
      File list:
      ${fileList.slice(0, 8000)}
      
      Return ONLY a valid JSON object with the following fields:
      - build_system: string
      - hardware_platform: string
      - rtos: string
      - core_drivers: string[]
      - architecture_style: string
    `;

    console.log("Sending request to local OneAPI...");
    const aiRes = await fetch(`${process.env.ONEAPI_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.ONEAPI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: "user", content: prompt }],
        // response_format: { type: "json_object" }, // 有些 OneAPI 可能不支持此参数，如果报错请注释掉
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`OneAPI Error: ${aiRes.status} - ${errText}`);
    }

    const aiData = await aiRes.json();
    const content = aiData.choices[0].message.content;
    
    // 提取并解析 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);

    console.log("Received AI response successfully from OneAPI");
    return NextResponse.json({ analysis });

  } catch (error: unknown) {
    console.error("Critical AI error:", error);
    const message = error instanceof Error ? error.message : "AI Analysis Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



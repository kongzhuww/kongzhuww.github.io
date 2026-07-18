import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const accessToken = token?.accessToken as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized or missing GitHub token" }, { status: 401 });
  }

  try {
    // 调用 GitHub API 获取当前用户的所有仓库 (按更新时间倒序)
    const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API responded with ${res.status}`);
    }

    const repos = (await res.json()) as GitHubRepo[];
    
    // 只返回我们需要的数据，减少 payload 大小
    const simplifiedRepos = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      language: repo.language,
      updated_at: repo.updated_at,
    }));

    return NextResponse.json({ repos: simplifiedRepos });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch GitHub repositories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

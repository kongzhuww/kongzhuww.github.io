"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  updated_at: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);

  // 1. 拦截未登录用户
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // 2. 获取 GitHub 仓库列表
  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const res = await fetch("/api/github/repos");
        if (res.ok) {
          const data = await res.json();
          // 可以简单过滤一下，优先展示 C/C++/Python/Assembly 等嵌入式可能用到的语言
          const embeddedRepos = data.repos.filter((r: GithubRepo) => 
            ['C', 'C++', 'Python', 'Assembly'].includes(r.language || '') || 
            (r.name.toLowerCase().includes('stm32') || r.name.toLowerCase().includes('esp'))
          );
          
          // 如果过滤后为空，就展示所有仓库
          setRepos(embeddedRepos.length > 0 ? embeddedRepos : data.repos);
        }
      } catch (err) {
        console.error("Failed to fetch repos", err);
      } finally {
        setIsLoadingRepos(false);
      }
    };

    if (status === "authenticated") {
      fetchRepos();
    }
  }, [status]);

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-lg">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            {session?.user?.image && (
              <img src={session.user.image} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-blue-500" />
            )}
            <div>
              <h1 className="text-xl font-bold">Hardware Projects Hub</h1>
              <p className="text-sm text-gray-400">Welcome, {session?.user?.name || session?.user?.email}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg border border-red-500/20 transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Repositories Section */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">My Embedded Projects</h2>
            <p className="text-sm text-gray-500">Synced from GitHub</p>
          </div>

          {isLoadingRepos ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-gray-900 rounded-2xl border border-gray-800"></div>
              ))}
            </div>
          ) : repos.length === 0 ? (
            <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-2xl">
              <p className="text-gray-400">No projects found. Try creating one on GitHub first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {repos.map(repo => (
                <div key={repo.id} className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-lg flex flex-col transition-transform hover:-translate-y-1 hover:border-blue-500/50">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-blue-400 truncate pr-2" title={repo.name}>
                      {repo.name}
                    </h3>
                    {repo.language && (
                      <span className="px-2 py-1 bg-gray-800 rounded text-xs font-mono text-gray-300 whitespace-nowrap">
                        {repo.language}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-400 flex-1 line-clamp-2 mb-6">
                    {repo.description || "No description provided."}
                  </p>
                  
                  <div className="mt-auto flex gap-3">
                    <Link 
                      href={`/dashboard/repo/${repo.id}?name=${encodeURIComponent(repo.full_name)}`}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-center text-sm font-medium"
                    >
                      Manage Pins
                    </Link>
                    <a 
                      href={repo.html_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm font-medium border border-gray-700 flex items-center justify-center"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

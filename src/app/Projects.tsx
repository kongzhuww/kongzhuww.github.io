"use client";

import { useEffect, useMemo, useState } from "react";

const GITHUB_USER = "kongzhuww";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  pushed_at: string;
  topics?: string[];
  fork: boolean;
  homepage: string | null;
  archived: boolean;
};

const LANG_COLOR: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  "C++": "#f34b7d",
  C: "#555555",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Vue: "#41b883",
  Dart: "#00B4AB",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
};

function langColor(lang: string | null) {
  return (lang && LANG_COLOR[lang]) || "#94a3b8";
}

function relTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const day = 86400000;
  if (diff < day) return "今天更新";
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前更新`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))} 个月前更新`;
  return `${Math.floor(diff / (365 * day))} 年前更新`;
}

type LoadState = "loading" | "ready" | "error";

export default function Projects() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=100`,
          { headers: { Accept: "application/vnd.github+json" } },
        );
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        const data = (await res.json()) as Repo[];
        if (!cancelled) {
          setRepos(data);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    return [...repos]
      .filter((r) => !r.fork && !r.archived)
      .sort((a, b) => {
        if (b.stargazers_count !== a.stargazers_count) return b.stargazers_count - a.stargazers_count;
        return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
      });
  }, [repos]);

  const visible = showAll ? sorted : sorted.slice(0, 6);
  const totalStars = useMemo(() => sorted.reduce((n, r) => n + r.stargazers_count, 0), [sorted]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-sky-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-[var(--heading)]">我的项目</h2>
          {state === "ready" ? (
            <span className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted)]">
              {sorted.length} 个 · ⭐ {totalStars}
            </span>
          ) : null}
        </div>
        <a
          href={`https://github.com/${GITHUB_USER}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--border-strong)]"
        >
          <GithubIcon /> @{GITHUB_USER}
        </a>
      </div>

      {state === "loading" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass h-36 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : state === "error" ? (
        <div className="glass rounded-2xl p-6 text-sm text-[var(--muted)]">
          暂时无法加载 GitHub 项目（可能触发了接口频率限制，稍后自动恢复）。
        </div>
      ) : sorted.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-sm text-[var(--muted)]">还没有公开的项目。</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((r) => (
              <a
                key={r.id}
                href={r.html_url}
                target="_blank"
                rel="noreferrer"
                className="glass glass-hover group flex flex-col rounded-2xl p-5"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-semibold text-[var(--heading)] transition group-hover:text-emerald-300">
                    <RepoIcon />
                    <span className="truncate">{r.name}</span>
                  </h3>
                  <span className="shrink-0 text-[var(--dim)] transition group-hover:translate-x-0.5 group-hover:text-[var(--text)]" aria-hidden="true">
                    ↗
                  </span>
                </div>

                <p className="mb-4 line-clamp-2 flex-1 text-sm leading-6 text-[var(--muted)]">
                  {r.description || "暂无描述"}
                </p>

                {r.topics && r.topics.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {r.topics.slice(0, 4).map((t) => (
                      <span key={t} className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                  {r.language ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: langColor(r.language) }} />
                      {r.language}
                    </span>
                  ) : null}
                  {r.stargazers_count > 0 ? <span>⭐ {r.stargazers_count}</span> : null}
                  {r.forks_count > 0 ? <span>⑂ {r.forks_count}</span> : null}
                  <span className="ml-auto text-[var(--dim)]" suppressHydrationWarning>
                    {relTime(r.pushed_at)}
                  </span>
                </div>
              </a>
            ))}
          </div>

          {sorted.length > 6 ? (
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--border-strong)]"
              >
                {showAll ? "收起" : `查看全部 ${sorted.length} 个项目`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.6 9.6 0 0 1 12 6.8c.85 0 1.71.11 2.51.33 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z" />
    </svg>
  );
}
function RepoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--muted)]">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

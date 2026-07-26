"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCloudPref } from "./useCloudPref";

// Sync the user's GitHub stars, let them file each repo into a category, and
// click through to the repo. Stars are cached locally; the categories + repo
// assignments sync to Supabase (survive cache-clears, follow you across devices).

const USER = "kongzhuww";
const STARS_KEY = "lw-gh-stars";
const CACHE_MS = 6 * 3600 * 1000;
const UNCAT = "未分类";

type Prefs = { cats: string[]; map: Record<string, string> };

type Repo = {
  fullName: string;
  url: string;
  name: string;
  owner: string;
  desc: string;
  lang: string;
  stars: number;
  avatar: string;
};

const LANG_COLOR: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Shell: "#89e051",
  Vue: "#41b883",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Dart: "#00B4AB",
  HTML: "#e34c26",
  CSS: "#563d7c",
};

async function fetchStars(): Promise<Repo[]> {
  const out: Repo[] = [];
  for (let page = 1; page <= 3; page++) {
    const r = await fetch(`https://api.github.com/users/${USER}/starred?per_page=100&page=${page}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!r.ok) {
      if (page === 1) throw new Error(`github ${r.status}`);
      break;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr: any[] = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) break;
    for (const it of arr) {
      out.push({
        fullName: it.full_name,
        url: it.html_url,
        name: it.name,
        owner: it.owner?.login ?? "",
        desc: it.description ?? "",
        lang: it.language ?? "",
        stars: it.stargazers_count ?? 0,
        avatar: it.owner?.avatar_url ?? "",
      });
    }
    if (arr.length < 100) break;
  }
  return out;
}

export default function GitHubStars() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const { value: prefs, setValue: setPrefs, signedIn, signIn } = useCloudPref<Prefs>("gh-stars", { cats: [], map: {} });
  const cats = prefs.cats;
  const map = prefs.map;
  const [active, setActive] = useState<string>("全部");
  const [newCat, setNewCat] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!force) {
      try {
        const raw = localStorage.getItem(STARS_KEY);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < CACHE_MS && Array.isArray(data) && data.length) {
            setRepos(data);
            setState("ready");
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }
    setState("loading");
    try {
      const data = await fetchStars();
      setRepos(data);
      setState("ready");
      try {
        localStorage.setItem(STARS_KEY, JSON.stringify({ ts: Date.now(), data }));
      } catch {
        /* ignore */
      }
    } catch {
      // fall back to any cache on error (e.g. rate limit)
      try {
        const raw = localStorage.getItem(STARS_KEY);
        if (raw) {
          const { data } = JSON.parse(raw);
          if (Array.isArray(data) && data.length) {
            setRepos(data);
            setState("ready");
            return;
          }
        }
      } catch {
        /* ignore */
      }
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function addCat() {
    const n = newCat.trim();
    if (!n || cats.includes(n) || n === UNCAT) {
      setNewCat("");
      setAdding(false);
      return;
    }
    setPrefs((p) => ({ ...p, cats: [...p.cats, n] }));
    setNewCat("");
    setAdding(false);
    setActive(n);
  }
  function delCat(name: string) {
    setPrefs((p) => {
      const nextMap = { ...p.map };
      for (const k of Object.keys(nextMap)) if (nextMap[k] === name) delete nextMap[k];
      return { cats: p.cats.filter((c) => c !== name), map: nextMap };
    });
    if (active === name) setActive("全部");
  }
  function assign(fullName: string, cat: string) {
    setPrefs((p) => {
      const nextMap = { ...p.map };
      if (!cat) delete nextMap[fullName];
      else nextMap[fullName] = cat;
      return { ...p, map: nextMap };
    });
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { 全部: repos.length, [UNCAT]: 0 };
    for (const cat of cats) c[cat] = 0;
    for (const r of repos) {
      const cat = map[r.fullName];
      if (cat && cats.includes(cat)) c[cat] = (c[cat] || 0) + 1;
      else c[UNCAT] = (c[UNCAT] || 0) + 1;
    }
    return c;
  }, [repos, cats, map]);

  const shown = useMemo(() => {
    if (active === "全部") return repos;
    if (active === UNCAT) return repos.filter((r) => !map[r.fullName] || !cats.includes(map[r.fullName]));
    return repos.filter((r) => map[r.fullName] === active);
  }, [repos, active, map, cats]);

  const tabs = ["全部", UNCAT, ...cats];

  return (
    <section className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-orange-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-[var(--heading)]">Star 收藏 · 分类</h2>
          <span className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted)]">
            ⭐ {repos.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-400" title="分类已云端同步">
              ☁️ 已同步
            </span>
          ) : (
            <button
              onClick={signIn}
              title="用 GitHub 登录后，分类会云端保存、跨设备同步"
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--heading)]"
            >
              ☁️ 登录同步
            </button>
          )}
          <button
            onClick={() => load(true)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--heading)]"
          >
            ↻ 同步 star
          </button>
        </div>
      </div>

      {/* category tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <span key={t} className="group relative inline-flex">
            <button
              onClick={() => setActive(t)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active === t
                  ? "border-amber-400/50 bg-amber-400/15 text-amber-300"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--heading)]"
              }`}
            >
              {t}
              <span className="ml-1.5 text-[var(--dim)]">{counts[t] ?? 0}</span>
              {t !== "全部" && t !== UNCAT ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    delCat(t);
                  }}
                  className="ml-1.5 text-[var(--dim)] hover:text-rose-400"
                  title="删除分类"
                >
                  ✕
                </span>
              ) : null}
            </button>
          </span>
        ))}
        {adding ? (
          <input
            autoFocus
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCat();
              if (e.key === "Escape") {
                setAdding(false);
                setNewCat("");
              }
            }}
            onBlur={addCat}
            placeholder="分类名…"
            className="w-28 rounded-full border border-amber-400/40 bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text)] outline-none"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="rounded-full border border-dashed border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-amber-400"
          >
            ＋ 新建分类
          </button>
        )}
      </div>

      {/* repo grid */}
      {state === "loading" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass h-28 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : state === "error" ? (
        <div className="glass rounded-2xl p-6 text-sm text-[var(--muted)]">
          无法获取 GitHub star（可能触发了接口频率限制，稍后点「↻ 同步」再试）。
        </div>
      ) : shown.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-sm text-[var(--muted)]">这个分类下还没有仓库。</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <div key={r.fullName} className="glass glass-hover group flex flex-col rounded-2xl p-4">
              <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.avatar} alt="" className="h-6 w-6 shrink-0 rounded-md" loading="lazy" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--heading)] transition group-hover:text-amber-400">
                  <span className="text-[var(--muted)]">{r.owner}/</span>
                  {r.name}
                </span>
              </a>
              {r.desc ? <p className="mt-2 line-clamp-2 flex-1 text-xs leading-5 text-[var(--muted)]">{r.desc}</p> : <div className="flex-1" />}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 text-[11px] text-[var(--dim)]">
                  {r.lang ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LANG_COLOR[r.lang] || "#8b949e" }} />
                      {r.lang}
                    </span>
                  ) : null}
                  <span>★ {r.stars.toLocaleString()}</span>
                </div>
                <select
                  value={map[r.fullName] && cats.includes(map[r.fullName]) ? map[r.fullName] : ""}
                  onChange={(e) => assign(r.fullName, e.target.value)}
                  className="max-w-[7rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text)] outline-none"
                  title="归类"
                >
                  <option value="">{UNCAT}</option>
                  {cats.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

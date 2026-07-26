"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  repo_name: string;
  description: string | null;
  stars: string | number;
  forks: string | number;
  language: string | null;
  total_score?: string | number;
};

type Period = { key: string; label: string; value: string };
const PERIODS: Period[] = [
  { key: "day", label: "今日", value: "past_24_hours" },
  { key: "week", label: "本周", value: "past_week" },
  { key: "month", label: "本月", value: "past_month" },
];

const LANGS = ["全部", "Python", "TypeScript", "JavaScript", "Go", "Rust", "C++", "Java"];

const LANG_COLOR: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  "C++": "#f34b7d",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
};

function num(v: string | number | undefined) {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "0").replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(n)) return "0";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

type LoadState = "loading" | "ready" | "error";

export default function Trending() {
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [period, setPeriod] = useState<Period>(PERIODS[0]);
  const [lang, setLang] = useState("全部");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const url = new URL("https://api.ossinsight.io/v1/trending/repos/");
      url.searchParams.set("period", period.value);
      if (lang !== "全部") url.searchParams.set("language", lang);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`ossinsight ${res.status}`);
      const data = await res.json();
      const list = (data?.data?.rows ?? []) as Row[];
      setRows(list.slice(0, 15));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [period, lang]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-orange-400 to-rose-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-[var(--heading)]">GitHub 热榜</h2>
          <span className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted)]">
            🔥 Trending
          </span>
        </div>
        <div className="flex rounded-full border border-[var(--border)] p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                period.key === p.key ? "bg-orange-400 text-[#08121a]" : "text-[var(--muted)] hover:text-[var(--heading)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* language filter */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              lang === l
                ? "bg-[var(--heading)] text-[var(--panel)]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--border-strong)]"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {state === "loading" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : state === "error" ? (
        <div className="glass rounded-2xl p-6 text-sm text-[var(--muted)]">
          热榜数据源暂时不可用，稍后再试。
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-sm text-[var(--muted)]">这个筛选下暂无数据。</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r, i) => {
            const [owner, name] = r.repo_name.split("/");
            return (
              <a
                key={r.repo_name}
                href={`https://github.com/${r.repo_name}`}
                target="_blank"
                rel="noreferrer"
                className="glass glass-hover group flex gap-3 rounded-2xl p-4"
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-bold ${
                    i < 3 ? "bg-gradient-to-br from-orange-400 to-rose-400 text-[#08121a]" : "bg-[var(--surface-hover)] text-[var(--muted)]"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--heading)] transition group-hover:text-orange-400">
                    <span className="text-[var(--dim)]">{owner}/</span>
                    {name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{r.description || "暂无描述"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted)]">
                    {r.language ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: LANG_COLOR[r.language] || "#94a3b8" }}
                        />
                        {r.language}
                      </span>
                    ) : null}
                    <span>⭐ {num(r.stars)}</span>
                    {Number(r.forks) > 0 ? <span>⑂ {num(r.forks)}</span> : null}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import KnowledgeBase from "./KnowledgeBase";

type SourceName = "HuggingFace Blog" | "OpenAI News" | "Hacker News" | "Google AI Blog";

type ReportItem = {
  title: string;
  source: string;
  url: string;
  summary: string;
  publishedAt?: string;
  tags?: string[];
  importance?: "high" | "medium" | "low" | string;
};

type DailyReport = {
  title: string;
  date: string;
  generatedAt: string;
  summary: string;
  highlights: string[];
  trends: string[];
  sources: { name: SourceName | string; count: number; url?: string }[];
  items: ReportItem[];
  sample?: boolean;
};

type ReportIndexItem = {
  date: string;
  title: string;
  path: string;
  itemCount?: number;
};

type ReportIndex = {
  latest: string;
  reports: ReportIndexItem[];
};

type LoadState = "loading" | "ready" | "fallback" | "error";

const SOURCE_PROFILES: Record<string, { domain: string; color: string }> = {
  "HuggingFace Blog": { domain: "huggingface.co", color: "#f59e0b" },
  "OpenAI News": { domain: "openai.com", color: "#10b981" },
  "Hacker News": { domain: "news.ycombinator.com", color: "#f97316" },
  "Google AI Blog": { domain: "blog.google", color: "#4285f4" },
};

const IMPORTANCE_STYLES: Record<string, { label: string; dot: string; text: string; ring: string }> = {
  high: { label: "重点", dot: "#f43f5e", text: "text-rose-300", ring: "ring-rose-500/30 bg-rose-500/10" },
  medium: { label: "关注", dot: "#f59e0b", text: "text-amber-300", ring: "ring-amber-500/30 bg-amber-500/10" },
  low: { label: "参考", dot: "#64748b", text: "text-[var(--text)]", ring: "ring-slate-500/30 bg-slate-500/10" },
};

const FALLBACK_REPORT: DailyReport = {
  title: "AI RSS 日报",
  date: "2026-07-18",
  generatedAt: "2026-07-18T08:00:00+08:00",
  summary: "这是示例日报。真实报告同步到 /reports/latest.json 后，页面会自动切换到当天内容。",
  highlights: [
    "四个固定 RSS 源统一进入一份早报，适合早上快速浏览。",
    "DeepSeek 摘要只在 n8n/VPS 侧生成，前端只读取静态 JSON。",
    "历史日报由 index.json 管理，可以逐步扩展归档、筛选和搜索。",
  ],
  trends: ["模型发布", "开发者工具", "开源社区", "AI 基础设施"],
  sources: [
    { name: "HuggingFace Blog", count: 3, url: "https://huggingface.co/blog" },
    { name: "OpenAI News", count: 3, url: "https://openai.com/news" },
    { name: "Hacker News", count: 6, url: "https://news.ycombinator.com" },
    { name: "Google AI Blog", count: 3, url: "https://blog.google/technology/ai/" },
  ],
  items: [
    {
      title: "示例：AI 产品发布节奏继续加快",
      source: "OpenAI News",
      url: "https://openai.com/news/",
      summary: "日报会把原始新闻压缩成可执行摘要：发生了什么、为什么重要、是否需要继续跟进。",
      tags: ["产品", "模型"],
      importance: "high",
    },
    {
      title: "示例：开源模型生态更新",
      source: "HuggingFace Blog",
      url: "https://huggingface.co/blog",
      summary: "来自 HuggingFace 的文章更适合跟踪开源模型、数据集、推理框架和社区实践。",
      tags: ["开源", "推理"],
      importance: "medium",
    },
    {
      title: "示例：开发者社区热点",
      source: "Hacker News",
      url: "https://news.ycombinator.com",
      summary: "Hacker News 条目适合发现工程侧讨论，例如成本、部署、工具链和实际使用反馈。",
      tags: ["工程", "社区"],
      importance: "medium",
    },
  ],
  sample: true,
};

const DEFAULT_INDEX: ReportIndex = {
  latest: "/reports/latest.json",
  reports: [
    {
      date: FALLBACK_REPORT.date,
      title: FALLBACK_REPORT.title,
      path: "/reports/latest.json",
      itemCount: FALLBACK_REPORT.items.length,
    },
  ],
};

function resolveReportPath(path: string) {
  if (!path) return "/reports/latest.json";
  if (path.startsWith("http") || path.startsWith("/")) return path;
  return `/reports/${path}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sourceProfile(source: string) {
  return SOURCE_PROFILES[source] ?? { domain: source, color: "#64748b" };
}

function sourceIconUrl(source: string) {
  const profile = sourceProfile(source);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(profile.domain)}&sz=64`;
}

function importanceStyle(importance?: string) {
  return IMPORTANCE_STYLES[importance ?? ""] ?? IMPORTANCE_STYLES.low;
}

function statusMeta(state: LoadState, report: DailyReport): { text: string; color: string } {
  if (state === "loading") return { text: "同步中", color: "#38bdf8" };
  if (state === "error") return { text: "读取失败", color: "#f43f5e" };
  if (state === "fallback" || report.sample) return { text: "示例数据", color: "#f59e0b" };
  return { text: "已同步", color: "#34d399" };
}

export default function Home() {
  const [report, setReport] = useState<DailyReport>(FALLBACK_REPORT);
  const [reportIndex, setReportIndex] = useState<ReportIndex>(DEFAULT_INDEX);
  const [selectedPath, setSelectedPath] = useState(DEFAULT_INDEX.latest);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function loadLatestReport() {
      try {
        const indexResponse = await fetch("/reports/index.json", { cache: "no-store" });
        const nextIndex = indexResponse.ok ? ((await indexResponse.json()) as ReportIndex) : DEFAULT_INDEX;
        const nextPath = resolveReportPath(nextIndex.latest || nextIndex.reports?.[0]?.path || DEFAULT_INDEX.latest);
        const reportResponse = await fetch(nextPath, { cache: "no-store" });

        if (!reportResponse.ok) throw new Error("Report JSON is not available");

        const nextReport = (await reportResponse.json()) as DailyReport;
        if (!cancelled) {
          setReportIndex(nextIndex);
          setSelectedPath(nextPath);
          setReport(nextReport);
          setLoadState(nextReport.sample ? "fallback" : "ready");
        }
      } catch {
        if (!cancelled) {
          setReportIndex(DEFAULT_INDEX);
          setSelectedPath(DEFAULT_INDEX.latest);
          setReport(FALLBACK_REPORT);
          setLoadState("fallback");
        }
      }
    }

    loadLatestReport();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalItems = report.items.length;
  const totalSources = report.sources.length;
  const highPriority = useMemo(
    () => report.items.filter((item) => item.importance === "high").length,
    [report.items],
  );
  const availableReports = reportIndex.reports.length > 0 ? reportIndex.reports : DEFAULT_INDEX.reports;

  async function loadReport(path: string) {
    const nextPath = resolveReportPath(path);
    setLoadState("loading");
    try {
      const response = await fetch(nextPath, { cache: "no-store" });
      if (!response.ok) throw new Error("Report JSON is not available");
      const nextReport = (await response.json()) as DailyReport;
      setSelectedPath(nextPath);
      setReport(nextReport);
      setLoadState(nextReport.sample ? "fallback" : "ready");
    } catch {
      setLoadState("error");
    }
  }

  const status = statusMeta(loadState, report);

  return (
    <main className="relative min-h-screen text-[var(--text)] selection:bg-emerald-400/30">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--header)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative grid h-11 w-11 place-items-center rounded-2xl">
              <span className="ring-spin absolute inset-0 rounded-2xl" aria-hidden="true" />
              <span className="absolute inset-[2px] grid place-items-center rounded-[14px] bg-[#080c15] text-sm font-black tracking-tight text-white">
                LW
              </span>
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
                LogicWeaver
              </p>
              <h1 className="text-lg font-semibold text-[var(--heading)]">AI RSS Daily</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <ThemeToggle />
            <span
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-medium text-[var(--text)]"
              style={{ color: status.color }}
            >
              <span className="pulse-dot inline-block h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
              <span className="text-[var(--text)]">{status.text} · 每天 08:00</span>
            </span>
            <a
              href="/reports/latest.json"
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
            >
              查看 JSON
            </a>
            <a
              href="https://github.com/kongzhuww/kongzhuww.github.io"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[var(--heading)] px-4 py-2 text-xs font-semibold text-[var(--panel)] transition hover:bg-emerald-300 hover:text-[#08121a]"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="mx-auto grid max-w-7xl gap-6 px-5 pt-10 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="glass animate-rise relative overflow-hidden rounded-3xl p-7 md:p-10">
          <div className="grid-overlay pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative">
            <div className="mb-7 flex flex-wrap items-center gap-2">
              {report.sources.map((source) => (
                <span
                  key={source.name}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text)]"
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-sm bg-white/90 bg-center bg-contain bg-no-repeat"
                    style={{ backgroundImage: `url(${sourceIconUrl(source.name)})` }}
                  />
                  {source.name}
                </span>
              ))}
            </div>

            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span suppressHydrationWarning>{formatDate(report.date)}</span>
            </div>

            <h2 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              <span className="text-gradient">{report.title}</span>
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text)] md:text-lg">
              {report.summary}
            </p>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              <Metric label="信息来源" value={totalSources} accent="#34d399" hint="RSS 源" />
              <Metric label="今日条目" value={totalItems} accent="#38bdf8" hint="篇文章" />
              <Metric label="重点关注" value={highPriority} accent="#f59e0b" hint="高优先级" />
            </div>
          </div>
        </div>

        {/* Sources aside */}
        <aside className="glass animate-rise flex flex-col rounded-3xl p-6" style={{ animationDelay: "80ms" }}>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">生成时间</p>
              <p className="mt-1 text-lg font-semibold text-[var(--heading)]" suppressHydrationWarning>
                {formatDateTime(report.generatedAt)}
              </p>
            </div>
            <span className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-300">
              JSON
            </span>
          </div>

          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--dim)]">来源分布</p>
          <div className="space-y-2.5">
            {report.sources.map((source) => {
              const profile = sourceProfile(source.name);
              return (
                <a
                  key={source.name}
                  href={source.url || `https://${profile.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-[var(--border-strong)]"
                      style={{ backgroundColor: profile.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-sm font-medium text-[var(--text)]">{source.name}</span>
                  </span>
                  <span className="ml-3 shrink-0 rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text)] transition group-hover:bg-[var(--surface-hover)]">
                    {source.count}
                  </span>
                </a>
              );
            })}
          </div>
        </aside>
      </section>

      {/* ---------- Body ---------- */}
      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-6">
          <Panel title="今日信号" count={report.highlights.length}>
            <div className="space-y-2.5">
              {report.highlights.map((highlight, i) => (
                <div
                  key={highlight}
                  className="glass glass-hover flex gap-3 rounded-2xl p-4"
                >
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-emerald-400/15 text-xs font-bold text-emerald-300">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-6 text-[var(--text)]">{highlight}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="趋势标签" count={report.trends.length}>
            <div className="flex flex-wrap gap-2">
              {report.trends.map((trend) => (
                <span
                  key={trend}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--text)] transition hover:border-emerald-400/30 hover:text-emerald-200"
                >
                  #{trend}
                </span>
              ))}
            </div>
          </Panel>

          <Panel title="历史日报" count={availableReports.length}>
            <div className="space-y-2">
              {availableReports.map((item) => {
                const path = resolveReportPath(item.path);
                const active = path === selectedPath;
                return (
                  <button
                    key={`${item.date}-${item.path}`}
                    onClick={() => loadReport(item.path)}
                    className={`group flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-emerald-400/40 bg-emerald-400/10"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-semibold ${active ? "text-emerald-200" : "text-[var(--text)]"}`}>
                        {item.title}
                      </span>
                      <span className={`mt-0.5 block text-xs ${active ? "text-emerald-300/70" : "text-[var(--dim)]"}`}>
                        {item.date} · {item.itemCount ?? "-"} 条
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-lg transition ${
                        active ? "text-emerald-300" : "text-[var(--dim)] group-hover:translate-x-0.5 group-hover:text-[var(--text)]"
                      }`}
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        <Panel title="新闻条目" count={loadState === "ready" || loadState === "fallback" ? report.items.length : undefined}>
          {loadState === "loading" ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="glass rounded-2xl p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="h-4 w-28 animate-pulse rounded bg-[var(--surface-hover)]" />
                    <div className="h-5 w-14 animate-pulse rounded-full bg-[var(--surface-hover)]" />
                  </div>
                  <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--surface-hover)]" />
                  <div className="mt-3 h-3 w-full animate-pulse rounded bg-[var(--surface)]" />
                  <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-[var(--surface)]" />
                </div>
              ))}
            </div>
          ) : loadState === "error" ? (
            <div className="glass rounded-2xl border-rose-500/30 bg-rose-500/5 p-6 text-sm text-rose-200">
              日报文件读取失败，请检查 JSON 路径。
            </div>
          ) : (
            <div className="grid gap-4">
              {report.items.map((item, i) => {
                const imp = importanceStyle(item.importance);
                return (
                  <article
                    key={`${item.source}-${item.title}`}
                    className="glass glass-hover animate-rise card-cv group rounded-2xl p-5 md:p-6"
                    style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                        <span
                          aria-hidden="true"
                          className="h-5 w-5 rounded-md bg-white/90 bg-center bg-contain bg-no-repeat ring-1 ring-[var(--border-strong)]"
                          style={{ backgroundImage: `url(${sourceIconUrl(item.source)})` }}
                        />
                        {item.source}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${imp.ring} ${imp.text}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: imp.dot }} />
                        {imp.label}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold leading-snug text-[var(--heading)] transition group-hover:text-emerald-100 md:text-xl">
                      {item.title}
                    </h3>
                    {item.summary ? (
                      <p className="mt-2.5 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{item.summary}</p>
                    ) : null}

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                      <div className="flex flex-wrap gap-2">
                        {(item.tags || []).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text)] transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200"
                      >
                        阅读原文
                        <span className="transition group-hover:translate-x-0.5" aria-hidden="true">↗</span>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-[var(--dim)] sm:flex-row">
          <p>
            <span className="font-semibold text-[var(--text)]">LogicWeaver</span> · AI RSS Daily —
            由 n8n 自动聚合，静态展示
          </p>
          <p className="font-mono text-xs" suppressHydrationWarning>
            每天 08:00 · {formatDate(report.date)}
          </p>
        </div>
      </footer>

      {/* Floating personal knowledge base */}
      <KnowledgeBase />
    </main>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("lw-theme", next);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "切换到白天模式" : "切换到黑夜模式"}
      title={theme === "dark" ? "白天模式" : "黑夜模式"}
      className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--heading)]"
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function Metric({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number;
  accent: string;
  hint: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--border-strong)]">
      <div
        className="absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-40 blur-2xl transition group-hover:opacity-70"
        style={{ backgroundColor: accent }}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="mb-3 h-1 w-9 rounded-full" style={{ backgroundColor: accent }} />
        <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-[var(--heading)] tabular-nums">{value}</span>
          <span className="text-xs text-[var(--dim)]">{hint}</span>
        </p>
      </div>
    </div>
  );
}

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-sky-400" aria-hidden="true" />
        <h2 className="text-base font-semibold text-[var(--heading)]">{title}</h2>
        {typeof count === "number" ? (
          <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">{count}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

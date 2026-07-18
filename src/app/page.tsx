"use client";

import { useEffect, useMemo, useState } from "react";

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

function statusText(state: LoadState, report: DailyReport) {
  if (state === "loading") return "同步中";
  if (state === "error") return "读取失败";
  if (state === "fallback" || report.sample) return "示例数据";
  return "已同步";
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


  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950 selection:bg-emerald-200">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-sm font-bold text-white">
              LW
            </div>
            <div>
              <p className="text-sm font-semibold uppercase text-slate-500">LogicWeaver</p>
              <h1 className="text-xl font-semibold text-slate-950">AI RSS Daily</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {statusText(loadState, report)} · 每天 08:00
            </span>
            <a
              href="/reports/latest.json"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              查看 JSON
            </a>
            <a
              href="https://github.com/kongzhuww/kongzhuww.github.io"
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-[#101820] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[1.35fr_0.65fr] lg:py-10">
          <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#121f2a] p-6 shadow-sm md:p-8">
            <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:32px_32px]" />
            <div className="relative">
              <div className="mb-8 flex flex-wrap items-center gap-3">
                {report.sources.map((source) => (
                  <span
                    key={source.name}
                    className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-100"
                  >
                    <span
                      aria-hidden="true"
                      className="h-5 w-5 rounded bg-white bg-center bg-contain bg-no-repeat"
                      style={{ backgroundImage: `url(${sourceIconUrl(source.name)})` }}
                    />
                    {source.name}
                  </span>
                ))}
              </div>

              <p className="mb-3 text-sm font-semibold uppercase text-emerald-300">{formatDate(report.date)}</p>
              <h2 className="max-w-3xl text-4xl font-semibold text-white md:text-6xl">{report.title}</h2>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 md:text-lg">{report.summary}</p>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                <Metric label="来源" value={totalSources.toString()} accent="#10b981" />
                <Metric label="条目" value={totalItems.toString()} accent="#38bdf8" />
                <Metric label="重点" value={highPriority.toString()} accent="#f59e0b" />
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-slate-700 bg-slate-900 p-5 text-white">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">生成时间</p>
                <p className="mt-1 text-lg font-semibold">{formatDateTime(report.generatedAt)}</p>
              </div>
              <span className="rounded-md bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200">
                JSON
              </span>
            </div>

            <div className="space-y-3">
              {report.sources.map((source) => {
                const profile = sourceProfile(source.name);
                return (
                  <a
                    key={source.name}
                    href={source.url || `https://${profile.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800 px-3 py-3 transition hover:border-slate-500"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: profile.color }} aria-hidden="true" />
                      <span className="truncate text-sm text-slate-200">{source.name}</span>
                    </span>
                    <span className="text-sm font-semibold text-slate-300">{source.count}</span>
                  </a>
                );
              })}
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-6">
          <Panel title="今日信号">
            <div className="space-y-3">
              {report.highlights.map((highlight) => (
                <div key={highlight} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm leading-6 text-slate-700">{highlight}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="趋势标签">
            <div className="flex flex-wrap gap-2">
              {report.trends.map((trend) => (
                <span key={trend} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  {trend}
                </span>
              ))}
            </div>
          </Panel>

          <Panel title="历史日报">
            <div className="space-y-2">
              {availableReports.map((item) => {
                const path = resolveReportPath(item.path);
                const active = path === selectedPath;
                return (
                  <button
                    key={`${item.date}-${item.path}`}
                    onClick={() => loadReport(item.path)}
                    className={`w-full rounded-md border px-3 py-3 text-left transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className={`mt-1 block text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                      {item.date} · {item.itemCount ?? "-"} 条
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        <Panel title="新闻条目">
          {loadState === "loading" ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">正在读取日报 JSON...</div>
          ) : loadState === "error" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">日报文件读取失败，请检查 JSON 路径。</div>
          ) : (
            <div className="grid gap-4">
              {report.items.map((item) => (
                <article key={`${item.source}-${item.title}`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                      <span
                        aria-hidden="true"
                        className="h-5 w-5 rounded bg-slate-100 bg-center bg-contain bg-no-repeat"
                        style={{ backgroundImage: `url(${sourceIconUrl(item.source)})` }}
                      />
                      {item.source}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-500">
                      {item.importance || "normal"}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap gap-2">
                      {(item.tags || []).map((tag) => (
                        <span key={tag} className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                    >
                      阅读原文
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </main>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-4">
      <div className="mb-3 h-1 w-10 rounded-sm" style={{ backgroundColor: accent }} />
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

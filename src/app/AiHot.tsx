"use client";

import { useCallback, useEffect, useState } from "react";

// Same-origin proxy served by the Cloudflare Worker -> https://aihot.virxact.com/api
const API = "/aihot";

type RawItem = Record<string, unknown>;

type Item = {
  id: string;
  title: string;
  summary: string;
  readUrl: string;
  sourceUrl?: string;
  source?: string;
  time?: string;
  category?: string;
};

const AIHOT_BASE = "https://aihot.virxact.com";

function pick(o: RawItem, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

// Scan an object (recursively) for the first plausible article URL.
function firstUrl(o: RawItem, depth = 0): string | undefined {
  if (depth > 3) return undefined;
  for (const v of Object.values(o)) {
    if (typeof v === "string" && /^https?:\/\//i.test(v) && !/\.(png|jpe?g|gif|webp|svg|ico)(\?|$)/i.test(v)) {
      return v;
    }
    if (v && typeof v === "object") {
      const n = firstUrl(v as RawItem, depth + 1);
      if (n) return n;
    }
  }
  return undefined;
}

// Turn a possibly-relative link into an absolute one (relative => aihot page).
function absolutize(u?: string): string {
  if (!u || u === "#") return "";
  if (/^https?:\/\//i.test(u)) return u;
  return AIHOT_BASE + (u.startsWith("/") ? u : `/${u}`);
}

function normalize(raw: RawItem, i: number): Item {
  const nested = (raw.source && typeof raw.source === "object" ? (raw.source as RawItem) : {}) as RawItem;
  // Prefer the original source link; fall back to any read link, then to the
  // first URL anywhere in the record (handles unknown field names).
  const source = absolutize(pick(raw, ["sourceUrl", "source_url", "originalUrl", "original_url", "origin", "originUrl"]));
  const read = absolutize(pick(raw, ["url", "link", "readUrl", "read_url", "href", "permalink", "canonical", "canonicalUrl", "web_url", "articleUrl", "mobileUrl", "pcUrl", "newsUrl"]));
  const readUrl = source || read || firstUrl(raw) || "#";
  return {
    id: pick(raw, ["id", "guid", "uuid"]) || String(i),
    title: pick(raw, ["title", "headline", "name"]) || "无标题",
    summary: pick(raw, ["summary", "description", "excerpt", "abstract", "digest"]) || "",
    readUrl,
    sourceUrl: source || undefined,
    source: pick(raw, ["sourceName", "source_name", "site", "author", "from"]) || pick(nested, ["name", "title"]),
    time: pick(raw, ["publishedAt", "published_at", "time", "date", "createdAt", "created_at", "publishTime"]),
    category: pick(raw, ["category", "tag", "type", "channel"]),
  };
}

function relTime(value?: string) {
  if (!value) return "";
  const d = new Date(/^\d+$/.test(value) ? Number(value) * (value.length <= 10 ? 1000 : 1) : value);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const min = 60000, hr = 3600000, day = 86400000;
  if (diff < hr) return `${Math.max(1, Math.floor(diff / min))} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hr)} 小时前`;
  return `${Math.floor(diff / day)} 天前`;
}

const WINDOWS = [
  { key: "24h", label: "过去 24 小时" },
  { key: "7d", label: "最近 7 天" },
];

type State = "loading" | "ready" | "error";

export default function AiHot() {
  const [items, setItems] = useState<Item[]>([]);
  const [state, setState] = useState<State>("loading");
  const [win, setWin] = useState("24h");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(`${API}/v1/items?mode=selected&window=${win}&limit=20`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`aihot ${res.status}`);
      const json = await res.json();
      const list: RawItem[] = Array.isArray(json)
        ? json
        : (json.items ?? json.data ?? json.results ?? []);
      setItems(list.map(normalize));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [win]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-sky-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-[var(--heading)]">AI HOT 热榜</h2>
          <span className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted)]">
            ⚡ AI 圈热点
          </span>
        </div>
        <div className="flex rounded-full border border-[var(--border)] p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWin(w.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                win === w.key ? "bg-emerald-400 text-[#08121a]" : "text-[var(--muted)] hover:text-[var(--heading)]"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {state === "loading" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : state === "error" ? (
        <div className="glass rounded-2xl p-6 text-sm text-[var(--muted)]">
          AI HOT 暂时不可用（接口频率限制或维护中，稍后再试）。
        </div>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-sm text-[var(--muted)]">这个时间窗内暂无精选。</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((it, i) => (
            <a
              key={it.id}
              href={it.readUrl}
              target="_blank"
              rel="noreferrer"
              className="glass glass-hover group flex gap-3 rounded-2xl p-4"
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-bold ${
                  i < 3
                    ? "bg-gradient-to-br from-emerald-400 to-sky-400 text-[#08121a]"
                    : "bg-[var(--surface-hover)] text-[var(--muted)]"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-[var(--heading)] transition group-hover:text-emerald-400">
                  {it.title}
                </p>
                {it.summary ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{it.summary}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--dim)]">
                  {it.category ? (
                    <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 font-medium text-emerald-300">
                      {it.category}
                    </span>
                  ) : null}
                  {it.source ? <span className="truncate">{it.source}</span> : null}
                  {relTime(it.time) ? <span className="shrink-0">{relTime(it.time)}</span> : null}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-[11px] text-[var(--dim)]">
        数据来自{" "}
        <a href="https://aihot.virxact.com" target="_blank" rel="noreferrer" className="underline hover:text-[var(--muted)]">
          AI HOT
        </a>
        （摘要由 AI 生成，重要信息请点开核对原文）
      </p>
    </section>
  );
}

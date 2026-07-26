"use client";

import { useCallback, useEffect, useState } from "react";

type Stats = {
  load?: number[];
  cpu_count?: number;
  mem?: { total: number; used: number; percent: number };
  disk?: { total: number; used: number; percent: number };
  uptime?: number;
  hostname?: string;
  offline?: boolean;
};

function bytes(n?: number) {
  if (!n) return "0";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)}${u[i]}`;
}

function uptimeStr(s?: number) {
  if (!s) return "-";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}天 ${h}小时`;
  if (h > 0) return `${h}小时 ${m}分`;
  return `${m}分`;
}

function color(pct: number) {
  if (pct >= 85) return "#ef4444";
  if (pct >= 60) return "#f59e0b";
  return "#34d399";
}

function Gauge({ label, pct, sub }: { label: string; pct: number; sub: string }) {
  const c = color(pct);
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
        <span className="text-lg font-bold tabular-nums" style={{ color: c }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: c }} />
      </div>
      <p className="mt-2 text-[11px] text-[var(--dim)]">{sub}</p>
    </div>
  );
}

export default function VpsProbe() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/vps/stats", { headers: { Accept: "application/json" } });
      const data = (await res.json()) as Stats;
      if (data.offline || !data.mem) {
        setState("offline");
        return;
      }
      setStats(data);
      setState("ready");
    } catch {
      setState("offline");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const loadPct =
    stats?.load && stats.cpu_count ? Math.min(100, (stats.load[0] / stats.cpu_count) * 100) : 0;

  return (
    <section className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-blue-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-[var(--heading)]">VPS 探针</h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              state === "ready"
                ? "bg-emerald-400/10 text-emerald-400"
                : state === "offline"
                  ? "bg-rose-500/10 text-rose-400"
                  : "bg-[var(--surface)] text-[var(--muted)]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                state === "ready" ? "bg-emerald-400" : state === "offline" ? "bg-rose-400" : "bg-[var(--dim)]"
              }`}
            />
            {state === "ready" ? "在线" : state === "offline" ? "离线" : "连接中"}
          </span>
        </div>
        {stats?.hostname ? <span className="font-mono text-xs text-[var(--dim)]">{stats.hostname}</span> : null}
      </div>

      {state === "offline" ? (
        <div className="glass rounded-2xl p-6 text-sm text-[var(--muted)]">
          VPS 探针离线（代理未运行或 /stats 未开放）。
        </div>
      ) : state === "loading" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Gauge
            label="CPU 负载"
            pct={loadPct}
            sub={`load ${stats?.load?.[0]?.toFixed(2) ?? "-"} · ${stats?.cpu_count ?? "-"} 核`}
          />
          <Gauge
            label="内存"
            pct={stats?.mem?.percent ?? 0}
            sub={`${bytes(stats?.mem?.used)} / ${bytes(stats?.mem?.total)}`}
          />
          <Gauge
            label="磁盘"
            pct={stats?.disk?.percent ?? 0}
            sub={`${bytes(stats?.disk?.used)} / ${bytes(stats?.disk?.total)}`}
          />
          <div className="glass rounded-2xl p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-medium text-[var(--muted)]">在线时长</span>
              <span className="text-lg">🟢</span>
            </div>
            <p className="text-lg font-bold text-[var(--heading)]">{uptimeStr(stats?.uptime)}</p>
            <p className="mt-2 text-[11px] text-[var(--dim)]">每 15 秒刷新</p>
          </div>
        </div>
      )}
    </section>
  );
}

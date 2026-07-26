"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, SUPABASE_ENABLED } from "./supabaseClient";

// Full-width "cockpit" hero: live clock, weather (Wuhan), a random 一言, and a
// row of today's aggregates (now playing / GitHub activity / RSS count).

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=30.59&longitude=114.31&current=temperature_2m,weather_code,apparent_temperature&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai";
const GH_EVENTS_URL = "https://api.github.com/users/kongzhuww/events/public?per_page=10";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function weatherInfo(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "晴" };
  if (code <= 2) return { emoji: "🌤️", label: "少云" };
  if (code === 3) return { emoji: "☁️", label: "多云" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "雾" };
  if (code >= 51 && code <= 57) return { emoji: "🌦️", label: "毛毛雨" };
  if (code >= 61 && code <= 67) return { emoji: "🌧️", label: "雨" };
  if (code >= 71 && code <= 77) return { emoji: "🌨️", label: "雪" };
  if (code >= 80 && code <= 82) return { emoji: "🌧️", label: "阵雨" };
  if (code >= 85 && code <= 86) return { emoji: "🌨️", label: "阵雪" };
  if (code >= 95) return { emoji: "⛈️", label: "雷雨" };
  return { emoji: "🌡️", label: "—" };
}

function greeting(h: number) {
  if (h < 5) return "夜深了";
  if (h < 9) return "早上好";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  if (h < 23) return "晚上好";
  return "夜深了";
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟前`;
  const hh = Math.floor(m / 60);
  if (hh < 24) return `${hh}小时前`;
  return `${Math.floor(hh / 24)}天前`;
}

type EventDesc = { text: string; repo: string; when: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeEvent(e: any): EventDesc | null {
  const repo = e?.repo?.name?.split("/").slice(-1)[0] ?? "";
  const map: Record<string, string> = {
    PushEvent: "推送代码",
    WatchEvent: "star 了",
    CreateEvent: "新建",
    PullRequestEvent: "PR",
    IssuesEvent: "issue",
    ForkEvent: "fork 了",
    IssueCommentEvent: "评论",
    ReleaseEvent: "发布",
    DeleteEvent: "删除",
  };
  const text = map[e?.type];
  if (!text || !repo) return null;
  return { text, repo, when: relTime(e.created_at) };
}

export default function DashboardHero({
  rssCount,
  onOpenReport,
}: {
  rssCount?: number;
  onOpenReport?: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<{ temp: number; code: number; max: number; min: number } | null>(null);
  const [playing, setPlaying] = useState<{ name: string; title: string } | null>(null);
  const [event, setEvent] = useState<EventDesc | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch(WEATHER_URL)
      .then((r) => r.json())
      .then((d) => {
        setWeather({
          temp: Math.round(d.current.temperature_2m),
          code: d.current.weather_code,
          max: Math.round(d.daily.temperature_2m_max[0]),
          min: Math.round(d.daily.temperature_2m_min[0]),
        });
      })
      .catch(() => {});

    fetch(GH_EVENTS_URL)
      .then((r) => (r.ok ? r.json() : []))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((arr: any[]) => {
        for (const e of arr || []) {
          const d = describeEvent(e);
          if (d) {
            setEvent(d);
            break;
          }
        }
      })
      .catch(() => {});
  }, []);

  const loadPlaying = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase
      .from("now_playing")
      .select("display_name, handle, title, status, updated_at")
      .order("updated_at", { ascending: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data as any[]) ?? [];
    const fresh = rows.find(
      (r) => r.status === "playing" && Date.now() - new Date(r.updated_at).getTime() < 90_000 && r.title,
    );
    setPlaying(fresh ? { name: fresh.display_name || fresh.handle, title: fresh.title } : null);
  }, []);

  useEffect(() => {
    loadPlaying();
    const t = setInterval(loadPlaying, 20_000);
    return () => clearInterval(t);
  }, [loadPlaying]);

  const h = now?.getHours() ?? 0;
  const hh = String(h).padStart(2, "0");
  const mm = String(now?.getMinutes() ?? 0).padStart(2, "0");
  const ss = String(now?.getSeconds() ?? 0).padStart(2, "0");
  const w = weather ? weatherInfo(weather.code) : null;

  return (
    <section className="relative w-full overflow-hidden border-b border-[var(--border)]">
      <div className="aurora-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-[1600px] gap-4 px-5 py-8 lg:grid-cols-[1.5fr_1fr]">
        {/* Clock */}
        <div className="glass rounded-3xl p-6">
          <p className="text-sm font-medium text-[var(--muted)]">{greeting(h)}</p>
          <p className="mt-2 font-mono text-5xl font-bold tabular-nums text-[var(--heading)] md:text-6xl" suppressHydrationWarning>
            {hh}:{mm}
            <span className="text-2xl text-[var(--muted)] md:text-3xl">:{ss}</span>
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]" suppressHydrationWarning>
            {now ? `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · ${WEEKDAYS[now.getDay()]}` : "—"}
          </p>
        </div>

        {/* Weather */}
        <div className="glass rounded-3xl p-6">
          <p className="text-sm font-medium text-[var(--muted)]">武汉 · 天气</p>
          {weather && w ? (
            <>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-5xl leading-none">{w.emoji}</span>
                <span className="text-5xl font-bold tabular-nums text-[var(--heading)]">{weather.temp}°</span>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {w.label} · 最高 {weather.max}° / 最低 {weather.min}°
              </p>
            </>
          ) : (
            <div className="mt-3 h-16 animate-pulse rounded-xl bg-[var(--surface-hover)]" />
          )}
        </div>

        {/* Aggregates */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-3">
          <div className="glass flex items-center gap-3 rounded-2xl p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-400/15 text-lg">🎧</span>
            <div className="min-w-0">
              <p className="text-xs text-[var(--muted)]">正在听</p>
              <p className="truncate text-sm font-semibold text-[var(--heading)]">
                {playing ? `${playing.name} · ${playing.title}` : "暂时没有人在听"}
              </p>
            </div>
          </div>

          <div className="glass flex items-center gap-3 rounded-2xl p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400/15 text-lg">🐙</span>
            <div className="min-w-0">
              <p className="text-xs text-[var(--muted)]">GitHub 动态</p>
              <p className="truncate text-sm font-semibold text-[var(--heading)]">
                {event ? `${event.text} ${event.repo} · ${event.when}` : "—"}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenReport}
            className="glass glass-hover flex items-center gap-3 rounded-2xl p-4 text-left transition"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-lg">📰</span>
            <div className="min-w-0">
              <p className="text-xs text-[var(--muted)]">今日 AI 日报</p>
              <p className="truncate text-sm font-semibold text-[var(--heading)]">
                {typeof rssCount === "number" && rssCount > 0 ? `${rssCount} 条 · 点击查看` : "点击查看"}
              </p>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}

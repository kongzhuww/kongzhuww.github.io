"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase, SUPABASE_ENABLED } from "./supabaseClient";

// A "friend activity" board: a small local bridge reads each person's Windows
// SMTC "now playing" (NetEase Cloud Music 3.0+, Spotify, anything that reports to
// SMTC) and upserts it into Supabase. Here we just subscribe to that table over
// Supabase Realtime and render who is listening to what, live.

type NowPlaying = {
  handle: string;
  display_name: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  cover: string | null;
  status: string | null; // "playing" | "paused" | "stopped"
  position_ms: number | null;
  duration_ms: number | null;
  app: string | null;
  updated_at: string;
};

const STALE_MS = 90_000; // no update in 90s → treat as offline

function fmt(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function HeadphoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M21 16a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2zM3 16a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2z" />
    </svg>
  );
}

export default function ListenTogether() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NowPlaying[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "off">("loading");
  const [now, setNow] = useState(0); // ticking clock for progress bars
  const mounted = useRef(false);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setState("off");
      return;
    }
    const { data, error } = await supabase
      .from("now_playing")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      setState("off");
      return;
    }
    setRows((data as NowPlaying[]) ?? []);
    setState("ready");
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!SUPABASE_ENABLED) {
      setState("off");
      return;
    }
    load();
    const supabase = getSupabase();
    const channel = supabase
      ?.channel("now_playing_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "now_playing" }, () => {
        if (mounted.current) load();
      })
      .subscribe();
    return () => {
      mounted.current = false;
      if (channel) supabase?.removeChannel(channel);
    };
  }, [load]);

  // tick every second while the panel is open (drives progress bars)
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const activeCount = useMemo(
    () => rows.filter((r) => r.status === "playing" && Date.now() - new Date(r.updated_at).getTime() < STALE_MS).length,
    [rows],
  );

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="一起听"
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs font-semibold text-[var(--heading)] transition hover:-translate-y-0.5 hover:border-rose-400/40 sm:px-3.5"
      >
        <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-rose-400 to-orange-400 text-[#08121a]">
          <HeadphoneIcon />
        </span>
        <span className="hidden sm:inline">一起听</span>
        {activeCount > 0 ? (
          <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-xs text-rose-300">{activeCount}</span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
          <section className="fixed inset-x-3 bottom-3 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl sm:inset-auto sm:right-5 sm:top-20 sm:h-[70vh] sm:max-h-[640px] sm:w-[380px]">
            <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-rose-400 to-orange-400 text-[#08121a]">
                  <HeadphoneIcon />
                </span>
                <p className="text-sm font-semibold text-[var(--heading)]">好友在听</p>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:text-[var(--heading)]">
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-3">
              {state === "off" ? (
                <div className="glass rounded-2xl p-4 text-sm text-[var(--muted)]">
                  未连接。需要先在 Supabase 建 <code className="text-[var(--text)]">now_playing</code> 表，并在电脑上运行 SMTC 桥接程序。
                </div>
              ) : state === "loading" ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="glass h-20 animate-pulse rounded-2xl" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="glass rounded-2xl p-4 text-sm text-[var(--muted)]">
                  还没有人在听。打开网易云（或任意支持 SMTC 的播放器）并运行桥接程序后，这里会实时显示。
                </div>
              ) : (
                <div className="space-y-2.5">
                  {rows.map((r) => {
                    const updatedAt = new Date(r.updated_at).getTime();
                    const stale = now - updatedAt > STALE_MS;
                    const playing = r.status === "playing" && !stale;
                    const basePos = r.position_ms ?? 0;
                    const livePos = playing ? basePos + Math.max(0, now - updatedAt) : basePos;
                    const dur = r.duration_ms ?? 0;
                    const pct = dur > 0 ? Math.min(100, (livePos / dur) * 100) : 0;
                    return (
                      <div key={r.handle} className={`glass rounded-2xl p-3 ${stale ? "opacity-60" : ""}`}>
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-hover)]">
                            {r.cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.cover} referrerPolicy="no-referrer" alt="" className={`h-full w-full object-cover ${playing ? "animate-spin-slow" : ""}`} />
                            ) : (
                              <span className="grid h-full w-full place-items-center text-[var(--dim)]">🎵</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-semibold text-[var(--heading)]">{r.display_name || r.handle}</span>
                              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${playing ? "bg-emerald-400/15 text-emerald-400" : "bg-[var(--surface)] text-[var(--dim)]"}`}>
                                <span className={`h-1 w-1 rounded-full ${playing ? "bg-emerald-400" : "bg-[var(--dim)]"}`} />
                                {stale ? "离线" : playing ? "在听" : "暂停"}
                              </span>
                            </div>
                            <p className="truncate text-sm text-[var(--text)]">{r.title || "—"}</p>
                            <p className="truncate text-xs text-[var(--muted)]">{r.artist || ""}{r.app ? ` · ${r.app}` : ""}</p>
                          </div>
                        </div>
                        {dur > 0 ? (
                          <div className="mt-2.5">
                            <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                              <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-400" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[var(--dim)]">
                              <span>{fmt(livePos)}</span>
                              <span>{fmt(dur)}</span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <footer className="border-t border-[var(--border)] px-4 py-2.5 text-[11px] text-[var(--dim)]">
              读取 Windows SMTC · 网易云 3.0+ / Spotify 等均可 · 实时同步
            </footer>
          </section>
        </>
      ) : null}
    </>
  );
}

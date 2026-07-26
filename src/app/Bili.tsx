"use client";

import { useCallback, useEffect, useState } from "react";

const BILI_UID = "668709429";
// Same-origin proxy served by the Cloudflare Worker (see worker.js).
const API = "/bili";

type Folder = { id: number; title: string; media_count: number };
type Media = {
  id: number;
  bvid: string;
  title: string;
  cover: string;
  duration: number;
  upper?: { name?: string };
  cnt_info?: { play?: number };
};

function https(u?: string) {
  if (!u) return u;
  if (u.startsWith("//")) return `https:${u}`;
  return u.replace(/^http:\/\//, "https://");
}

function fmtDuration(s: number) {
  if (!s || s < 0) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function fmtPlay(n?: number) {
  if (!n) return "";
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

async function api<T>(path: string): Promise<{ code: number; data: T }> {
  const res = await fetch(`${API}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`bili ${res.status}`);
  return res.json();
}

type State = "loading" | "ready" | "error";

export default function Bili() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersState, setFoldersState] = useState<State>("loading");
  const [active, setActive] = useState<Folder | null>(null);
  const [medias, setMedias] = useState<Media[]>([]);
  const [mediaState, setMediaState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await api<{ list: Folder[] }>(`/x/v3/fav/folder/created/list-all?up_mid=${BILI_UID}`);
        const list = json.data?.list ?? [];
        if (cancelled) return;
        if (json.code !== 0 || list.length === 0) {
          setFoldersState("error");
          return;
        }
        setFolders(list);
        setActive(list[0]);
        setFoldersState("ready");
      } catch {
        if (!cancelled) setFoldersState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMedia = useCallback(async (folder: Folder) => {
    setActive(folder);
    setMediaState("loading");
    setMedias([]);
    try {
      const json = await api<{ medias: Media[] }>(
        `/x/v3/fav/resource/list?media_id=${folder.id}&pn=1&ps=24&platform=web`,
      );
      setMedias(json.data?.medias ?? []);
      setMediaState("ready");
    } catch {
      setMediaState("error");
    }
  }, []);

  useEffect(() => {
    if (active) loadMedia(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  if (foldersState === "error") {
    return (
      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="mb-5 flex items-center gap-3">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-pink-400 to-rose-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-[var(--heading)]">B站收藏</h2>
        </div>
        <div className="glass rounded-2xl p-6 text-sm text-[var(--muted)]">
          暂时无法加载 B站公开收藏夹（可能没有公开的收藏夹，或接口被风控，稍后再试）。
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-pink-400 to-rose-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-[var(--heading)]">B站收藏</h2>
          <span className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted)]">
            📺 公开收藏夹
          </span>
        </div>
        <a
          href={`https://space.bilibili.com/${BILI_UID}/favlist`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--border-strong)]"
        >
          去 B站主页
        </a>
      </div>

      <div className="glass grid gap-0 overflow-hidden rounded-2xl lg:grid-cols-[200px_1fr]">
        {/* Folder sidebar */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-[var(--border)] p-2 lg:flex-col lg:gap-1 lg:overflow-x-visible lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-3">
          {foldersState === "loading"
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 w-24 shrink-0 animate-pulse rounded-lg bg-[var(--surface)] lg:w-full" />
              ))
            : folders.map((f) => {
                const on = active?.id === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActive(f)}
                    className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition lg:w-full ${
                      on
                        ? "bg-pink-400/15 font-semibold text-pink-400"
                        : "text-[var(--text)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    <span className="truncate">{f.title}</span>
                    <span className={`shrink-0 text-[11px] ${on ? "text-pink-400/70" : "text-[var(--dim)]"}`}>
                      {f.media_count}
                    </span>
                  </button>
                );
              })}
        </div>

        {/* Video grid */}
        <div className="min-h-[16rem] p-3">
          {mediaState === "loading" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-video animate-pulse rounded-xl bg-[var(--surface)]" />
              ))}
            </div>
          ) : mediaState === "error" ? (
            <div className="p-4 text-sm text-[var(--muted)]">加载失败，换个收藏夹或稍后再试。</div>
          ) : medias.length === 0 ? (
            <div className="p-4 text-sm text-[var(--muted)]">这个收藏夹是空的。</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {medias.map((m) => (
                <a
                  key={m.id}
                  href={`https://www.bilibili.com/video/${m.bvid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group"
                >
                  <div className="relative aspect-video overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={https(m.cover)}
                      alt={m.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                    {m.duration ? (
                      <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {fmtDuration(m.duration)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-5 text-[var(--text)] transition group-hover:text-pink-400">
                    {m.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--dim)]">
                    <span className="truncate">{m.upper?.name}</span>
                    {m.cnt_info?.play ? <span className="shrink-0">▶ {fmtPlay(m.cnt_info.play)}</span> : null}
                  </p>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

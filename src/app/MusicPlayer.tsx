"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Same-origin proxy served by the Cloudflare Worker (see worker.js), which
// forwards to the Monster Siren API. Same-origin means no CORS at all.
const API = "/siren";

type Album = { cid: string; name: string; coverUrl: string; artistes?: string[] };
type Song = { cid: string; name: string; artistes?: string[]; artists?: string[] };
type SongDetail = {
  cid: string;
  name: string;
  sourceUrl: string;
  coverUrl?: string;
  lyricUrl?: string;
  artists?: string[];
  albumCid?: string;
};

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`monster-siren ${res.status}`);
  const json = await res.json();
  return (json && json.data !== undefined ? json.data : json) as T;
}

// Cover images can come back as http:// which a https page blocks as mixed
// content — force https.
function https(u?: string) {
  return u ? u.replace(/^http:\/\//, "https://") : u;
}

function fmtTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Known Arknights-official uploaders on Bilibili (used to boost, then badge).
const OFFICIAL_MIDS = new Set([161775300]); // 明日方舟
const OFFICIAL_NAMES = new Set(["明日方舟", "塞壬唱片-MSR", "塞壬唱片"]);

type BiliHit = { bvid: string | null; author: string; official: boolean };

// Look up a Bilibili video for a song via the Worker's /bili proxy. Many
// Arknights MVs live on the game's official account, but plenty are on the
// artist's own official channel (Mili, Steve Aoki, …). So we pick the most
// popular result (highest play count), preferring the Arknights-official
// account when it has a result, and surface the uploader name either way.
async function searchBiliBvid(keyword: string): Promise<BiliHit> {
  try {
    const r = await fetch(
      `/bili/x/web-interface/search/type?search_type=video&page=1&keyword=${encodeURIComponent(keyword)}`,
      { headers: { Accept: "application/json" } },
    );
    const j = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = (j?.data?.result ?? []).filter((v: any) => v?.bvid);
    if (list.length === 0) return { bvid: null, author: "", official: false };
    const byPlay = [...list].sort((a, b) => (b.play || 0) - (a.play || 0));
    const official = byPlay.find((v) => OFFICIAL_MIDS.has(v.mid) || OFFICIAL_NAMES.has(v.author));
    const pick = official || byPlay[0];
    return { bvid: pick.bvid, author: pick.author || "", official: !!official };
  } catch {
    return { bvid: null, author: "", official: false };
  }
}

export default function MusicPlayer() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);

  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumsState, setAlbumsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [album, setAlbum] = useState<Album | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(false);

  const [current, setCurrent] = useState<SongDetail | null>(null);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);

  // Bilibili MV state for focus mode
  const [bvid, setBvid] = useState<string | null>(null);
  const [bvidOfficial, setBvidOfficial] = useState(false);
  const [bvidAuthor, setBvidAuthor] = useState("");
  const [bvidState, setBvidState] = useState<"idle" | "loading" | "ready" | "empty">("idle");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceCache = useRef<Map<string, SongDetail>>(new Map());
  const bvidCache = useRef<Map<string, BiliHit>>(new Map());
  const currentRef = useRef<SongDetail | null>(null);
  const wasPlayingRef = useRef(false);
  currentRef.current = current;

  useEffect(() => setMounted(true), []);

  const loadAlbums = useCallback(async () => {
    if (albumsState === "ready" || albumsState === "loading") return;
    setAlbumsState("loading");
    try {
      const data = await api<Album[]>("/albums");
      setAlbums(data);
      setAlbumsState("ready");
    } catch {
      setAlbumsState("error");
    }
  }, [albumsState]);

  useEffect(() => {
    if (open) loadAlbums();
  }, [open, loadAlbums]);

  async function openAlbum(a: Album) {
    setAlbum(a);
    setSongs([]);
    setSongsLoading(true);
    try {
      const detail = await api<{ songs: Song[]; coverUrl: string; name: string }>(`/album/${a.cid}/detail`);
      setSongs(detail.songs ?? []);
    } catch {
      setSongs([]);
    } finally {
      setSongsLoading(false);
    }
  }

  const getSong = useCallback(async (cid: string): Promise<SongDetail> => {
    const cached = sourceCache.current.get(cid);
    if (cached) return cached;
    const d = await api<SongDetail>(`/song/${cid}`);
    sourceCache.current.set(cid, d);
    return d;
  }, []);

  const playAt = useCallback(
    async (i: number) => {
      if (i < 0 || i >= songs.length) return;
      setIndex(i);
      setBuffering(true);
      try {
        const detail = await getSong(songs[i].cid);
        setCurrent(detail);
        const audio = audioRef.current;
        if (audio && !focus) {
          audio.src = detail.sourceUrl;
          await audio.play();
          setPlaying(true);
        } else {
          setBuffering(false); // in focus, the Bilibili MV effect takes over
        }
      } catch {
        setBuffering(false);
      }
    },
    [songs, getSong, focus],
  );

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  const next = useCallback(() => {
    if (songs.length === 0) return;
    playAt((index + 1) % songs.length);
  }, [index, songs, playAt]);

  const prev = useCallback(() => {
    if (songs.length === 0) return;
    playAt((index - 1 + songs.length) % songs.length);
  }, [index, songs, playAt]);

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const t = (Number(e.target.value) / 100) * duration;
    audio.currentTime = t;
    setProgress(t);
  }

  // Entering focus pauses our audio (the Bilibili player has its own sound);
  // leaving focus resumes it where it was.
  useEffect(() => {
    const audio = audioRef.current;
    if (focus) {
      if (audio) {
        wasPlayingRef.current = !audio.paused;
        audio.pause();
        setPlaying(false);
      }
    } else {
      setBvid(null);
      setBvidState("idle");
      const cur = currentRef.current;
      if (audio && cur) {
        if (audio.getAttribute("src") !== cur.sourceUrl) audio.src = cur.sourceUrl;
        if (wasPlayingRef.current) {
          audio.play().catch(() => {});
          setPlaying(true);
        }
      }
    }
  }, [focus]);

  // In focus mode, find the Bilibili MV for the current song.
  useEffect(() => {
    if (!focus || !current) return;
    let cancelled = false;
    const cid = current.cid;
    const apply = (hit: BiliHit) => {
      setBvid(hit.bvid);
      setBvidOfficial(hit.official);
      setBvidAuthor(hit.author);
      setBvidState(hit.bvid ? "ready" : "empty");
    };
    if (bvidCache.current.has(cid)) {
      apply(bvidCache.current.get(cid)!);
      return;
    }
    setBvid(null);
    setBvidState("loading");
    searchBiliBvid(`${current.name} 明日方舟`).then((hit) => {
      if (cancelled) return;
      bvidCache.current.set(cid, hit);
      apply(hit);
    });
    return () => {
      cancelled = true;
    };
  }, [focus, current]);

  // Esc leaves focus mode
  useEffect(() => {
    if (!focus) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocus(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [focus]);

  return (
    <>
      {/* hidden audio element persists playback across panel open/close */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlaying={() => {
          setBuffering(false);
          setPlaying(true);
        }}
        onWaiting={() => setBuffering(true)}
        onPause={() => setPlaying(false)}
        onEnded={next}
      />

      {/* Launcher / now-playing pill */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1 pl-1 pr-2 text-xs font-semibold text-[var(--heading)] transition hover:-translate-y-0.5 hover:border-violet-400/40 sm:pr-3.5"
        >
          <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 text-[#08121a]">
            {current?.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={https(current.coverUrl)} referrerPolicy="no-referrer" alt="" className={`h-full w-full object-cover ${playing ? "animate-spin-slow" : ""}`} />
            ) : (
              <MusicIcon />
            )}
          </span>
          {mounted && current ? (
            <span className="hidden max-w-[7rem] truncate sm:inline">{current.name}</span>
          ) : (
            <span className="hidden sm:inline">塞壬电台</span>
          )}
          {mounted && current ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="grid h-6 w-6 place-items-center rounded-full bg-[var(--surface-hover)] text-[var(--heading)]"
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </span>
          ) : null}
        </button>
      ) : null}

      {/* Panel */}
      {open ? (
        <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      ) : null}
      {open ? (
        <section
          role="dialog"
          aria-label="塞壬电台"
          className="fixed inset-x-3 bottom-3 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl sm:inset-auto sm:bottom-5 sm:left-1/2 sm:top-auto sm:h-[80vh] sm:max-h-[760px] sm:w-[440px] sm:-translate-x-1/2"
        >
          <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-400 text-[#08121a]">
                <MusicIcon />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-[var(--heading)]">塞壬电台</p>
                <p className="text-[11px] text-[var(--muted)]">明日方舟 · Monster Siren</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {current ? (
                <button
                  onClick={() => setFocus(true)}
                  title="专注模式 · 播放 MV"
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-400/40 bg-violet-400/15 px-2.5 py-1 text-xs font-medium text-violet-300 transition hover:bg-violet-400/25"
                >
                  <FocusIcon />
                  专注
                </button>
              ) : null}
              {album ? (
                <button
                  onClick={() => setAlbum(null)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--heading)]"
                >
                  ← 专辑
                </button>
              ) : null}
              <IconButton title="关闭" onClick={() => setOpen(false)}>
                <CloseIcon />
              </IconButton>
            </div>
          </header>

          {/* Browser */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {albumsState === "loading" ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-xl bg-[var(--surface)]" />
                ))}
              </div>
            ) : albumsState === "error" ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
                无法加载塞壬唱片列表（可能是跨域限制）。稍后我可加一个中转修复。
              </div>
            ) : !album ? (
              <div className="grid grid-cols-2 gap-3">
                {albums.map((a) => (
                  <button key={a.cid} onClick={() => openAlbum(a)} className="group text-left">
                    <div className="aspect-square overflow-hidden rounded-xl border border-[var(--border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={https(a.coverUrl)}
                        referrerPolicy="no-referrer"
                        alt={a.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    </div>
                    <p className="mt-1.5 truncate text-xs font-medium text-[var(--text)]">{a.name}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div className="mb-4 flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={https(album.coverUrl)} referrerPolicy="no-referrer" alt="" className="h-20 w-20 rounded-xl border border-[var(--border)] object-cover" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--heading)]">{album.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{songsLoading ? "加载中…" : `${songs.length} 首`}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {songs.map((s, i) => {
                    const active = current?.cid === s.cid;
                    return (
                      <button
                        key={s.cid}
                        onClick={() => playAt(i)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                          active ? "bg-violet-400/15" : "hover:bg-[var(--surface)]"
                        }`}
                      >
                        <span className={`w-5 text-center text-xs ${active ? "text-violet-400" : "text-[var(--dim)]"}`}>
                          {active && playing ? "♪" : i + 1}
                        </span>
                        <span className={`min-w-0 flex-1 truncate text-sm ${active ? "font-semibold text-violet-300" : "text-[var(--text)]"}`}>
                          {s.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Now playing controls */}
          {current ? (
            <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <div className="mb-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={https(current.coverUrl || album?.coverUrl)} referrerPolicy="no-referrer" alt="" className="h-10 w-10 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--heading)]">{current.name}</p>
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {(current.artists ?? []).join(", ") || "Monster Siren"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton title="上一首" onClick={prev}><PrevIcon /></IconButton>
                  <button
                    onClick={togglePlay}
                    className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 text-[#08121a]"
                  >
                    {buffering ? <span className="text-xs">…</span> : playing ? <PauseIcon /> : <PlayIcon />}
                  </button>
                  <IconButton title="下一首" onClick={next}><NextIcon /></IconButton>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[var(--dim)]">
                <span className="tabular-nums">{fmtTime(progress)}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={duration ? (progress / duration) * 100 : 0}
                  onChange={seek}
                  className="h-1 flex-1 accent-violet-400"
                />
                <span className="tabular-nums">{fmtTime(duration)}</span>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Focus mode overlay: Bilibili MV for the current song */}
      {focus ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">{current?.name ?? "专注模式"}</p>
              <p className="truncate text-xs text-white/50">
                {bvidState === "ready"
                  ? `UP · ${bvidAuthor || "Bilibili"}${bvidOfficial ? " · 官方" : ""}`
                  : "明日方舟 · Bilibili"}
              </p>
            </div>
            <button
              onClick={() => setFocus(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              ✕ 退出专注
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden px-4">
            {bvidState === "loading" ? (
              <p className="text-sm text-white/50">正在从 Bilibili 找这首歌的视频…</p>
            ) : bvidState === "ready" && bvid ? (
              <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-xl bg-black">
                <iframe
                  key={bvid}
                  src={`https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=1&high_quality=1&danmaku=0`}
                  title="Bilibili MV"
                  className="h-full w-full"
                  scrolling="no"
                  frameBorder="0"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={https(current?.coverUrl || album?.coverUrl)}
                  referrerPolicy="no-referrer"
                  alt=""
                  className="h-56 w-56 rounded-full object-cover shadow-2xl ring-4 ring-white/10"
                />
                <p className="text-sm text-white/50">没找到这首歌的视频 · 试试上/下一首</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 px-5 py-5">
            <button onClick={prev} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20" title="上一首">
              <PrevIcon />
            </button>
            <button onClick={next} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20" title="下一首">
              <NextIcon />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--heading)]"
    >
      {children}
    </button>
  );
}

function MusicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
function FocusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function PlayIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}
function PauseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>;
}
function PrevIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14l-11-7z" /></svg>;
}
function NextIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5l11 7-11 7z" /></svg>;
}
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

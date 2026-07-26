"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API = "https://monster-siren.hypergryph.com/api";

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
  return json.data as T;
}

function fmtTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function MusicPlayer() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceCache = useRef<Map<string, SongDetail>>(new Map());

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
        if (audio) {
          audio.src = detail.sourceUrl;
          await audio.play();
          setPlaying(true);
        }
      } catch {
        setBuffering(false);
      }
    },
    [songs, getSong],
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

      {/* Launcher / now-playing pill (bottom center) */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--launcher)] py-2 pl-2 pr-4 text-sm font-semibold text-[var(--heading)] shadow-[0_18px_40px_-18px_rgba(139,92,246,0.6)] transition hover:-translate-x-1/2 hover:-translate-y-0.5 hover:border-violet-400/40"
        >
          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 text-[#08121a]">
            {current?.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.coverUrl} alt="" className={`h-full w-full object-cover ${playing ? "animate-spin-slow" : ""}`} />
            ) : (
              <MusicIcon />
            )}
          </span>
          {mounted && current ? (
            <span className="max-w-[9rem] truncate">{current.name}</span>
          ) : (
            <span>塞壬电台</span>
          )}
          {mounted && current ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="grid h-7 w-7 place-items-center rounded-full bg-[var(--surface-hover)] text-[var(--heading)]"
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
                  <button
                    key={a.cid}
                    onClick={() => openAlbum(a)}
                    className="group text-left"
                  >
                    <div className="aspect-square overflow-hidden rounded-xl border border-[var(--border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.coverUrl}
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
                  <img src={album.coverUrl} alt="" className="h-20 w-20 rounded-xl border border-[var(--border)] object-cover" />
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
                <img src={current.coverUrl || album?.coverUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
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

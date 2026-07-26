"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setNowPlaying, setControls, type PlayMode } from "./nowPlayingStore";

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

type LyricLine = { t: number; text: string };

const MODE_KEY = "lw-play-mode";

// Credit lines (composer / arranger / vocals …) that instrumental tracks put in
// their LRC. If a song has only these, treat it as pure music.
function isCreditLine(t: string) {
  return /(作曲|作词|編曲|编曲|演唱|和声|合声|混音|母带|制作|出品|监制|吉他|贝斯|钢琴|鼓|弦乐|Vocal|Compos|Arrang|Lyric|Writ|Mix|Master|Produc|Guitar|Bass|Piano|Drum|Strings|feat\.)/i.test(t);
}

// Parse an LRC lyric file into timestamped lines.
function parseLRC(txt: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const line of txt.split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = line.replace(/\[[^\]]*\]/g, "").trim();
    if (!stamps.length || !text) continue;
    for (const g of stamps) {
      const t = Number(g[1]) * 60 + Number(g[2]) + (g[3] ? Number(`0.${g[3]}`) : 0);
      out.push({ t, text });
    }
  }
  return out.sort((a, b) => a.t - b.t);
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
  const [tv, setTv] = useState(false); // the retro-TV MV window

  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumsState, setAlbumsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [album, setAlbum] = useState<Album | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(false);
  const [allSongs, setAllSongs] = useState<Song[]>([]); // whole library = play queue

  const [current, setCurrent] = useState<SongDetail | null>(null);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);

  // Bilibili MV state for the TV window
  const [bvid, setBvid] = useState<string | null>(null);
  const [bvidOfficial, setBvidOfficial] = useState(false);
  const [bvidAuthor, setBvidAuthor] = useState("");
  const [bvidState, setBvidState] = useState<"idle" | "loading" | "ready" | "empty">("idle");
  const [tvPos, setTvPos] = useState<{ x: number; y: number } | null>(null);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [mode, setMode] = useState<PlayMode>("list");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceCache = useRef<Map<string, SongDetail>>(new Map());
  const bvidCache = useRef<Map<string, BiliHit>>(new Map());
  const currentRef = useRef<SongDetail | null>(null);
  const wasPlayingRef = useRef(false);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelDrag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  currentRef.current = current;

  useEffect(() => {
    setMounted(true);
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === "one" || m === "shuffle" || m === "list") setMode(m);
    } catch {
      /* ignore */
    }
  }, []);

  function cycleMode() {
    setMode((m) => {
      const order: PlayMode[] = ["list", "one", "shuffle"];
      const nx = order[(order.indexOf(m) + 1) % order.length];
      try {
        localStorage.setItem(MODE_KEY, nx);
      } catch {
        /* ignore */
      }
      return nx;
    });
  }

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

  // The playback queue is the whole Monster Siren catalog, so prev/next can
  // cross album boundaries. Fetch it once when the panel first opens.
  useEffect(() => {
    if (!open || allSongs.length) return;
    api<{ list: Song[] }>("/songs")
      .then((d) => setAllSongs(d.list ?? []))
      .catch(() => {});
  }, [open, allSongs.length]);

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

  // Load synced lyrics (LRC) for the current song.
  useEffect(() => {
    setLyrics([]);
    const url = current?.lyricUrl;
    if (!url) return;
    let cancelled = false;
    // Route through the Worker's /lyric proxy — the CDN has no CORS headers.
    fetch(`/lyric?url=${encodeURIComponent(https(url)!)}`)
      .then((r) => r.text())
      .then((txt) => {
        if (!cancelled) setLyrics(parseLRC(txt));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [current]);

  const playAt = useCallback(
    async (i: number) => {
      if (i < 0 || i >= allSongs.length) return;
      setIndex(i);
      setBuffering(true);
      try {
        const detail = await getSong(allSongs[i].cid);
        setCurrent(detail);
        const audio = audioRef.current;
        if (audio && !tv) {
          audio.src = detail.sourceUrl;
          await audio.play();
          setPlaying(true);
        } else {
          setBuffering(false); // TV on: the MV window provides sound + picture
        }
      } catch {
        setBuffering(false);
      }
    },
    [allSongs, getSong, tv],
  );

  // Play a song by cid, locating it in the global queue (used by the album list).
  const playByCid = useCallback(
    async (cid: string) => {
      const gi = allSongs.findIndex((s) => s.cid === cid);
      if (gi >= 0) {
        playAt(gi);
        return;
      }
      // queue not ready yet — play it standalone
      setBuffering(true);
      try {
        const detail = await getSong(cid);
        setCurrent(detail);
        const audio = audioRef.current;
        if (audio && !tv) {
          audio.src = detail.sourceUrl;
          await audio.play();
          setPlaying(true);
        } else {
          setBuffering(false);
        }
      } catch {
        setBuffering(false);
      }
    },
    [allSongs, playAt, getSong, tv],
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
    const n = allSongs.length;
    if (n === 0) return;
    if (mode === "shuffle" && n > 1) {
      let r = index;
      while (r === index) r = Math.floor(Math.random() * n);
      playAt(r);
      return;
    }
    playAt((index + 1) % n);
  }, [index, allSongs, playAt, mode]);

  const prev = useCallback(() => {
    const n = allSongs.length;
    if (n === 0) return;
    playAt((index - 1 + n) % n);
  }, [index, allSongs, playAt]);

  // end-of-track behaviour depends on the play mode
  const onEnded = useCallback(() => {
    if (mode === "one") {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }
    next();
  }, [mode, next]);

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const t = (Number(e.target.value) / 100) * duration;
    audio.currentTime = t;
    setProgress(t);
  }

  // TV on pauses our audio (the Bilibili player has its own sound); TV off
  // resumes it where it was.
  useEffect(() => {
    const audio = audioRef.current;
    if (tv) {
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
  }, [tv]);

  // While the TV is on, find the Bilibili MV for the current song.
  useEffect(() => {
    if (!tv || !current) return;
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
  }, [tv, current]);

  // dragging the TV window by its title bar
  function onDragDown(e: React.PointerEvent) {
    const el = e.currentTarget.parentElement as HTMLElement | null;
    const rect = el?.getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: rect?.left ?? 0, oy: rect?.top ?? 0 };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const x = drag.current.ox + (e.clientX - drag.current.sx);
    const y = drag.current.oy + (e.clientY - drag.current.sy);
    setTvPos({
      x: Math.max(0, Math.min(window.innerWidth - 120, x)),
      y: Math.max(0, Math.min(window.innerHeight - 80, y)),
    });
  }
  function onDragUp() {
    drag.current = null;
  }

  // dragging the whole player panel by its header
  function onPanelDown(e: React.PointerEvent) {
    const rect = panelRef.current?.getBoundingClientRect();
    panelDrag.current = { sx: e.clientX, sy: e.clientY, ox: rect?.left ?? 0, oy: rect?.top ?? 0 };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPanelMove(e: React.PointerEvent) {
    if (!panelDrag.current) return;
    const x = panelDrag.current.ox + (e.clientX - panelDrag.current.sx);
    const y = panelDrag.current.oy + (e.clientY - panelDrag.current.sy);
    setPanelPos({
      x: Math.max(0, Math.min(window.innerWidth - 160, x)),
      y: Math.max(0, Math.min(window.innerHeight - 80, y)),
    });
  }
  function onPanelUp() {
    panelDrag.current = null;
  }

  const tvStyle: React.CSSProperties = tvPos
    ? { left: tvPos.x, top: tvPos.y, right: "auto", bottom: "auto" }
    : { right: 20, bottom: 20 };

  // current synced lyric line
  let li = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].t <= progress + 0.2) li = i;
    else break;
  }
  const curLyric = li >= 0 ? lyrics[li].text : lyrics.length ? "♪ ♪ ♪" : "";
  const nextLyric = li + 1 < lyrics.length ? lyrics[li + 1].text : "";
  // pure music: no real (non-credit) lyric lines
  const instrumental = !!current && !lyrics.some((l) => l.text && !isCreditLine(l.text));
  const barLine = instrumental ? "纯音乐" : curLyric;
  const barSub = instrumental ? "" : nextLyric;

  // publish now-playing state (line + controls state) to the header bar
  useEffect(() => {
    setNowPlaying({ line: barLine, sub: barSub, hasSong: !!current, playing, mode });
  }, [barLine, barSub, current, playing, mode]);
  useEffect(() => () => setNowPlaying({ line: "", sub: "", hasSong: false, playing: false }), []);

  // register playback controls for the header bar (stable wrappers → latest fns)
  const prevRef = useRef(prev);
  const nextRef = useRef(next);
  const toggleRef = useRef(togglePlay);
  const cycleRef = useRef(cycleMode);
  prevRef.current = prev;
  nextRef.current = next;
  toggleRef.current = togglePlay;
  cycleRef.current = cycleMode;
  useEffect(() => {
    setControls({
      prev: () => prevRef.current(),
      next: () => nextRef.current(),
      toggle: () => toggleRef.current(),
      cycleMode: () => cycleRef.current(),
    });
  }, []);

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
        onEnded={onEnded}
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
          {mounted && current ? null : <span className="hidden sm:inline">塞壬电台</span>}
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
          ref={panelRef}
          role="dialog"
          aria-label="塞壬电台"
          style={panelPos ? { left: panelPos.x, top: panelPos.y, right: "auto", bottom: "auto", transform: "none" } : undefined}
          className="fixed inset-x-3 bottom-3 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl sm:inset-auto sm:bottom-5 sm:left-1/2 sm:top-auto sm:h-[80vh] sm:max-h-[760px] sm:w-[440px] sm:-translate-x-1/2"
        >
          <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div
              onPointerDown={onPanelDown}
              onPointerMove={onPanelMove}
              onPointerUp={onPanelUp}
              className="flex flex-1 cursor-grab touch-none items-center gap-2.5 active:cursor-grabbing"
              title="拖动移动窗口"
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-400 text-[#08121a]">
                <MusicIcon />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-[var(--heading)]">塞壬电台</p>
                <p className="text-[11px] text-[var(--muted)]">明日方舟 · Monster Siren</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTv((v) => !v)}
                title="小电视 · 播放 MV"
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  tv
                    ? "border-violet-400/50 bg-violet-400/20 text-violet-200"
                    : "border-violet-400/40 bg-violet-400/15 text-violet-300 hover:bg-violet-400/25"
                }`}
              >
                <TvIcon />
                MV
              </button>
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
                        onClick={() => playByCid(s.cid)}
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

      {/* Retro-TV MV window */}
      {tv ? (
        <div className="fixed z-[60] select-none" style={tvStyle}>
          <div className="rounded-[20px] border border-black/40 bg-gradient-to-b from-[#2a2620] to-[#171310] p-3 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.8)]">
            {/* title bar (drag handle) */}
            <div
              onPointerDown={onDragDown}
              onPointerMove={onDragMove}
              onPointerUp={onDragUp}
              className="mb-2 flex cursor-grab touch-none items-center justify-between gap-2 px-1 active:cursor-grabbing"
            >
              <span className="truncate text-[11px] font-semibold tracking-wide text-amber-200/90">
                📺 {current?.name ?? "明日方舟 MV"}
              </span>
              <button
                onClick={() => setTv(false)}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-black/40 text-[10px] text-white/70 transition hover:text-white"
                title="关掉电视"
              >
                ✕
              </button>
            </div>

            {/* CRT screen */}
            <div className="relative aspect-video w-[300px] overflow-hidden rounded-[10px] bg-black shadow-[inset_0_0_36px_rgba(0,0,0,0.9)] ring-2 ring-black/60 sm:w-[340px]">
              {bvidState === "loading" ? (
                <div className="grid h-full w-full place-items-center text-[11px] text-emerald-300/70">
                  <span className="animate-pulse">📡 搜索 MV 信号…</span>
                </div>
              ) : bvidState === "ready" && bvid ? (
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
              ) : (
                <div className="grid h-full w-full place-items-center px-3 text-center text-[11px] text-white/50">
                  没有信号 · 这首暂无视频<br />试试上/下一首
                </div>
              )}
              {/* scanlines + vignette overlay for the retro look */}
              <div
                className="pointer-events-none absolute inset-0 rounded-[10px]"
                style={{
                  background:
                    "repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)",
                  boxShadow: "inset 0 0 40px rgba(0,0,0,0.55)",
                }}
                aria-hidden="true"
              />
            </div>

            {/* controls / label row */}
            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <span className="truncate text-[10px] text-amber-200/60">
                {bvidState === "ready" ? `${bvidAuthor || "Bilibili"}${bvidOfficial ? " · 官方" : ""}` : "Bilibili"}
              </span>
              <div className="flex items-center gap-1.5">
                <button onClick={prev} title="上一首" className="grid h-6 w-6 place-items-center rounded-full bg-black/40 text-white/70 transition hover:text-white">
                  <PrevIcon />
                </button>
                <button onClick={next} title="下一首" className="grid h-6 w-6 place-items-center rounded-full bg-black/40 text-white/70 transition hover:text-white">
                  <NextIcon />
                </button>
              </div>
            </div>
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
function TvIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="13" rx="2" />
      <path d="m17 2-5 5-5-5" />
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
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14l-11-7z" /></svg>;
}
function NextIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5l11 7-11 7z" /></svg>;
}
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

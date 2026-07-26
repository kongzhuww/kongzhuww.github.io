"use client";

import { useSyncExternalStore } from "react";
import {
  subscribeNowPlaying,
  getNowPlaying,
  getServerNowPlaying,
  getControls,
  type PlayMode,
} from "./nowPlayingStore";

const MODE: Record<PlayMode, { icon: string; label: string }> = {
  list: { icon: "🔁", label: "列表循环" },
  one: { icon: "🔂", label: "单曲循环" },
  shuffle: { icon: "🔀", label: "随机播放" },
};

// Full-width control + lyric bar under the header. Persists while a song is
// loaded (shows "纯音乐" for instrumentals), with prev / play / next / mode.
export default function LyricBar() {
  const s = useSyncExternalStore(subscribeNowPlaying, getNowPlaying, getServerNowPlaying);
  if (!s.hasSong) return null;
  const c = getControls();
  const m = MODE[s.mode];

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)]/40">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:gap-3 sm:px-5">
        <BarBtn title="上一首" onClick={() => c.prev()}>
          <PrevIcon />
        </BarBtn>
        <BarBtn title="播放 / 暂停" onClick={() => c.toggle()}>
          {s.playing ? <PauseIcon /> : <PlayIcon />}
        </BarBtn>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-base font-semibold text-gradient sm:text-xl">{s.line || "♪"}</p>
          {s.sub ? <p className="hidden truncate text-xs text-[var(--dim)] md:block">{s.sub}</p> : null}
        </div>

        <BarBtn title="下一首" onClick={() => c.next()}>
          <NextIcon />
        </BarBtn>
        <button
          onClick={() => c.cycleMode()}
          title={m.label}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm transition hover:border-violet-400/40"
        >
          {m.icon}
        </button>
      </div>
    </div>
  );
}

function BarBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--heading)] transition hover:border-violet-400/40 hover:text-violet-400"
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}
function PauseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>;
}
function PrevIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14l-11-7z" /></svg>;
}
function NextIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5l11 7-11 7z" /></svg>;
}

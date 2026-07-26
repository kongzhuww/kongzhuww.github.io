"use client";

import { useSyncExternalStore } from "react";
import { subscribeLyric, getLyricSnapshot, getServerLyricSnapshot } from "./nowPlayingStore";

// Full-width second row under the header: the current synced lyric line.
export default function LyricBar() {
  const { line, next } = useSyncExternalStore(subscribeLyric, getLyricSnapshot, getServerLyricSnapshot);
  if (!line) return null;
  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)]/40">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-4 px-5 py-2.5">
        <p className="truncate text-lg font-semibold text-gradient sm:text-xl">{line}</p>
        {next ? <p className="hidden truncate text-sm text-[var(--dim)] md:block">{next}</p> : null}
      </div>
    </div>
  );
}

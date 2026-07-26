// Tiny external store so the header lyric bar can read the current synced lyric
// line that the MusicPlayer computes. Avoids threading props across siblings.

type LyricState = { line: string; next: string };

const EMPTY: LyricState = { line: "", next: "" };
let state: LyricState = EMPTY;
const listeners = new Set<() => void>();

export function setLyricLine(line: string, next: string) {
  if (state.line === line && state.next === next) return;
  state = line || next ? { line, next } : EMPTY;
  listeners.forEach((l) => l());
}

export function subscribeLyric(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getLyricSnapshot(): LyricState {
  return state;
}

export function getServerLyricSnapshot(): LyricState {
  return EMPTY;
}

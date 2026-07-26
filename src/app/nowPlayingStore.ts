// Shared now-playing state + controls so the header lyric/control bar can show
// the current line and drive playback without prop-drilling across siblings.

export type PlayMode = "list" | "one" | "shuffle";

type State = {
  title: string;
  cover: string;
  line: string;
  sub: string;
  hasSong: boolean;
  playing: boolean;
  mode: PlayMode;
};

const EMPTY: State = { title: "", cover: "", line: "", sub: "", hasSong: false, playing: false, mode: "list" };
let state: State = EMPTY;
const listeners = new Set<() => void>();

export function setNowPlaying(patch: Partial<State>) {
  const nx = { ...state, ...patch };
  if (
    nx.title === state.title &&
    nx.cover === state.cover &&
    nx.line === state.line &&
    nx.sub === state.sub &&
    nx.hasSong === state.hasSong &&
    nx.playing === state.playing &&
    nx.mode === state.mode
  ) {
    return;
  }
  state = nx;
  listeners.forEach((l) => l());
}

export function subscribeNowPlaying(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getNowPlaying(): State {
  return state;
}

export function getServerNowPlaying(): State {
  return EMPTY;
}

// Playback controls, registered by the MusicPlayer, called by the bar.
type Controls = { prev: () => void; next: () => void; toggle: () => void; cycleMode: () => void };
let controls: Controls = { prev: () => {}, next: () => {}, toggle: () => {}, cycleMode: () => {} };

export function setControls(c: Controls) {
  controls = c;
}
export function getControls(): Controls {
  return controls;
}

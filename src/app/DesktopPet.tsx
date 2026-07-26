"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Arknights Spine models (isHarryh/Ark-Models) via jsDelivr CDN (CORS-friendly).
const CDN = "https://cdn.jsdelivr.net/gh/isHarryh/Ark-Models@main";
// Spine 3.8 runtime over HTTPS via jsDelivr.
const SPINE_JS = "https://cdn.jsdelivr.net/gh/EsotericSoftware/spine-runtimes@3.8/spine-ts/build/spine-player.js";
const SPINE_CSS = "https://cdn.jsdelivr.net/gh/EsotericSoftware/spine-runtimes@3.8/spine-ts/player/css/spine-player.css";

const CUR_KEY = "lw-pet-current";
const DL_KEY = "lw-pet-downloaded";
const SCALE_KEY = "lw-pet-scale";
const FACE_KEY = "lw-pet-face";
const WALK_KEY = "lw-pet-walk";

const IDLE_ANIMS = ["Relax", "Idle", "Sit", "Interact_1", "Interact"];
const MOVE_ANIMS = ["Move", "Walk", "Run", "move"];
const INTERACT_ANIMS = ["Interact", "Interact_1", "Special", "Attack", "Sleep"];

const BASE_W = 160;
const BASE_H = 200;
const WALK_SPEED = 0.8; // px per frame

type Model = { key: string; name: string; skelUrl: string; atlasUrl: string };

let spineLoading: Promise<void> | null = null;
function loadSpine(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  const w = window as unknown as { spine?: { SpinePlayer?: unknown } };
  if (w.spine?.SpinePlayer) return Promise.resolve();
  if (spineLoading) return spineLoading;
  spineLoading = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${SPINE_CSS}"]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = SPINE_CSS;
      document.head.appendChild(css);
    }
    const js = document.createElement("script");
    js.src = SPINE_JS;
    js.onload = () => resolve();
    js.onerror = () => reject(new Error("spine runtime failed"));
    document.head.appendChild(js);
  });
  return spineLoading;
}

export default function DesktopPet() {
  const [current, setCurrent] = useState<Model | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [modelsState, setModelsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [query, setQuery] = useState("");
  const [downloaded, setDownloaded] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(0.7); // default 小
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(true); // default 走路开
  const [menuOpen, setMenuOpen] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const baseRef = useRef<string>("Relax"); // current looping animation to return to
  const facingRef = useRef<1 | -1>(1);
  const scaleRef = useRef(1);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ startX: number; startY: number; ox: number; oy: number; moved: boolean } | null>(null);

  useEffect(() => {
    facingRef.current = facing;
  }, [facing]);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const setPosBoth = useCallback((p: { x: number; y: number } | null) => {
    posRef.current = p;
    setPos(p);
  }, []);

  // restore last-used pet + prefs (assets are browser-cached, so this is fast)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUR_KEY);
      if (raw) setCurrent(JSON.parse(raw));
      const dl = localStorage.getItem(DL_KEY);
      if (dl) setDownloaded(JSON.parse(dl));
      const s = parseFloat(localStorage.getItem(SCALE_KEY) || "");
      if (s > 0) setScale(s);
      const f = localStorage.getItem(FACE_KEY);
      if (f === "-1") setFacing(-1);
      const wk = localStorage.getItem(WALK_KEY);
      if (wk === "0") setWalking(false);
    } catch {
      /* ignore */
    }
  }, []);

  // helper: switch the looping "base" animation (idle / move) and remember it
  const setBase = useCallback((kind: "idle" | "move") => {
    const player = playerRef.current;
    if (!player?.animationState) return;
    try {
      const anims: string[] = player.skeleton.data.animations.map((a: { name: string }) => a.name);
      const pool = kind === "move" ? MOVE_ANIMS : IDLE_ANIMS;
      const name = pool.find((n) => anims.includes(n)) ?? anims[0];
      baseRef.current = name;
      player.animationState.setAnimation(0, name, true);
    } catch {
      /* ignore */
    }
  }, []);

  // (re)initialise the spine player whenever the current model changes
  useEffect(() => {
    if (!current || !hostRef.current) return;
    let disposed = false;
    setStatus("loading");
    loadSpine()
      .then(() => {
        if (disposed || !hostRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const spine = (window as any).spine;
        try {
          playerRef.current?.dispose?.();
        } catch {
          /* ignore */
        }
        hostRef.current.innerHTML = "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        playerRef.current = new spine.SpinePlayer(hostRef.current, {
          skelUrl: current.skelUrl,
          atlasUrl: current.atlasUrl,
          premultipliedAlpha: true,
          alpha: true,
          backgroundColor: "#00000000",
          showControls: false,
          showLoading: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          success: (player: any) => {
            try {
              const anims: string[] = player.skeleton.data.animations.map((a: { name: string }) => a.name);
              const idle = IDLE_ANIMS.find((n) => anims.includes(n)) ?? anims[0];
              baseRef.current = idle;
              player.animationState.setAnimation(0, idle, true);
              setStatus("idle");
            } catch {
              setStatus("error");
            }
          },
          error: () => setStatus("error"),
        });
      })
      .catch(() => setStatus("error"));
    return () => {
      disposed = true;
    };
  }, [current]);

  // walking: wander along the bottom, flip at the edges, play the Move animation
  useEffect(() => {
    if (!walking || !current || status === "loading") return;
    setBase("move");
    const floorY = Math.max(0, window.innerHeight - Math.round(BASE_H * scaleRef.current) - 8);
    let x = posRef.current?.x ?? window.innerWidth - 220;
    let dir: 1 | -1 = facingRef.current;
    let raf = 0;
    const step = () => {
      const w = Math.round(BASE_W * scaleRef.current);
      const maxX = window.innerWidth - w;
      x += dir * WALK_SPEED;
      if (x <= 0) {
        x = 0;
        dir = 1;
        setFacing(1);
      } else if (x >= maxX) {
        x = maxX;
        dir = -1;
        setFacing(-1);
      }
      setPosBoth({ x, y: floorY });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      setBase("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walking, current, status]);

  const ensureModels = useCallback(async () => {
    if (modelsState === "ready" || modelsState === "loading") return;
    setModelsState("loading");
    try {
      const res = await fetch(`${CDN}/models_data.json`);
      const json = await res.json();
      const data = json.data ?? {};
      const list: Model[] = Object.entries(data)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter(([, m]: [string, any]) => m?.type === "Operator" && m?.style === "BuildingDefault" && m?.assetList?.[".skel"] && m?.assetList?.[".atlas"])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map(([key, m]: [string, any]) => ({
          key,
          name: m.name,
          skelUrl: `${CDN}/models/${key}/${m.assetList[".skel"]}`,
          atlasUrl: `${CDN}/models/${key}/${m.assetList[".atlas"]}`,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "zh"));
      setModels(list);
      setModelsState("ready");
    } catch {
      setModelsState("error");
    }
  }, [modelsState]);

  function openPicker() {
    setPickerOpen(true);
    ensureModels();
  }

  function pick(m: Model) {
    setWalking(false);
    setCurrent(m);
    setPickerOpen(false);
    setPosBoth(null);
    try {
      localStorage.setItem(CUR_KEY, JSON.stringify(m));
      const next = Array.from(new Set([...downloaded, m.key]));
      setDownloaded(next);
      localStorage.setItem(DL_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function dismiss() {
    setWalking(false);
    setCurrent(null);
    try {
      playerRef.current?.dispose?.();
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(CUR_KEY);
    } catch {
      /* ignore */
    }
  }

  function changeScale(s: number) {
    setScale(s);
    try {
      localStorage.setItem(SCALE_KEY, String(s));
    } catch {
      /* ignore */
    }
  }

  function changeFacing(f: 1 | -1) {
    setFacing(f);
    try {
      localStorage.setItem(FACE_KEY, String(f));
    } catch {
      /* ignore */
    }
  }

  function changeWalking(w: boolean) {
    setWalking(w);
    try {
      localStorage.setItem(WALK_KEY, w ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const interact = useCallback(() => {
    const player = playerRef.current;
    if (!player?.animationState) return;
    try {
      const anims: string[] = player.skeleton.data.animations.map((a: { name: string }) => a.name);
      const act = INTERACT_ANIMS.find((n) => anims.includes(n) && n !== baseRef.current);
      if (!act) return;
      player.animationState.setAnimation(0, act, false);
      player.animationState.addAnimation(0, baseRef.current, true, 0);
    } catch {
      /* ignore */
    }
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    const rect = hostRef.current?.parentElement?.getBoundingClientRect();
    drag.current = { startX: e.clientX, startY: e.clientY, ox: rect?.left ?? 0, oy: rect?.top ?? 0, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.current.moved = true;
    if (drag.current.moved) {
      if (walking) setWalking(false); // dragging takes over from walking
      setPosBoth({
        x: Math.max(0, Math.min(window.innerWidth - 120, drag.current.ox + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 120, drag.current.oy + dy)),
      });
    }
  }
  function onPointerUp() {
    if (drag.current && !drag.current.moved) interact();
    drag.current = null;
  }

  const filtered = query.trim()
    ? models.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 80)
    : models.slice(0, 80);

  const style: React.CSSProperties = pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : { right: 16, bottom: 88 };

  const ctrlBtn = "rounded-full border border-[var(--border)] bg-[var(--panel)] px-2 py-0.5 text-[10px] text-[var(--muted)] shadow transition hover:text-[var(--heading)]";
  const ctrlOn = "rounded-full border border-violet-400/50 bg-violet-400/15 px-2 py-0.5 text-[10px] text-violet-300 shadow";

  return (
    <>
      {/* Launcher (only when no active pet) */}
      {!current ? (
        <button
          onClick={openPicker}
          title="选择明日方舟桌宠"
          className="fixed bottom-20 right-5 z-50 grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] bg-[var(--launcher)] text-lg shadow-lg transition hover:-translate-y-0.5 hover:border-violet-400/40"
        >
          🐧
        </button>
      ) : null}

      {/* Active pet */}
      {current ? (
        <div className="group fixed z-40 select-none" style={style}>
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuOpen((v) => !v);
            }}
            className="relative cursor-grab touch-none active:cursor-grabbing"
            style={{ width: BASE_W, height: BASE_H }}
          >
            <div
              ref={hostRef}
              className="h-full w-full"
              style={{ transform: `scale(${scale}) scaleX(${facing})`, transformOrigin: "center bottom" }}
            />
            {status === "loading" ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-[var(--dim)]">加载中…</div>
            ) : status === "error" ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[10px] text-rose-400">加载失败</div>
            ) : null}
            <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
              {current.name} · 右键设置
            </div>
          </div>

          {/* Right-click config menu */}
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-[45]" onClick={() => setMenuOpen(false)} onContextMenu={(e) => { e.preventDefault(); setMenuOpen(false); }} aria-hidden="true" />
              <div className="absolute bottom-full left-1/2 z-[46] mb-2 w-44 -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-2.5 text-sm shadow-2xl">
                <p className="mb-2 truncate px-1 text-[11px] font-semibold text-[var(--heading)]">{current.name}</p>

                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--muted)]">走路</span>
                  <button
                    onClick={() => changeWalking(!walking)}
                    className={walking ? ctrlOn : ctrlBtn}
                  >
                    {walking ? "开" : "关"}
                  </button>
                </div>

                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--muted)]">大小</span>
                  <div className="flex gap-1">
                    <button onClick={() => changeScale(0.7)} className={scale === 0.7 ? ctrlOn : ctrlBtn}>小</button>
                    <button onClick={() => changeScale(1)} className={scale === 1 ? ctrlOn : ctrlBtn}>中</button>
                    <button onClick={() => changeScale(1.4)} className={scale === 1.4 ? ctrlOn : ctrlBtn}>大</button>
                  </div>
                </div>

                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--muted)]">朝向</span>
                  <div className="flex gap-1">
                    <button onClick={() => changeFacing(-1)} className={facing === -1 ? ctrlOn : ctrlBtn}>⬅</button>
                    <button onClick={() => changeFacing(1)} className={facing === 1 ? ctrlOn : ctrlBtn}>➡</button>
                  </div>
                </div>

                <div className="mt-2 flex gap-1 border-t border-[var(--border)] pt-2">
                  <button onClick={() => { setMenuOpen(false); openPicker(); }} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--muted)] transition hover:text-[var(--heading)]">🔀 换干员</button>
                  <button onClick={() => { setMenuOpen(false); dismiss(); }} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--muted)] transition hover:text-[var(--heading)]">✕ 隐藏</button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Picker */}
      {pickerOpen ? (
        <>
          <div className="fixed inset-0 z-[55] bg-black/40" onClick={() => setPickerOpen(false)} aria-hidden="true" />
          <section className="fixed inset-x-4 bottom-4 top-16 z-[56] mx-auto flex max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl sm:inset-auto sm:bottom-1/2 sm:left-1/2 sm:h-[70vh] sm:w-[400px] sm:-translate-x-1/2 sm:translate-y-1/2">
            <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🐧</span>
                <p className="text-sm font-semibold text-[var(--heading)]">选择干员桌宠</p>
              </div>
              <button onClick={() => setPickerOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:text-[var(--heading)]">
                ✕
              </button>
            </header>
            <div className="border-b border-[var(--border)] px-4 py-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索干员名…"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--dim)] outline-none focus:border-violet-400/40"
              />
              <p className="mt-2 text-[11px] text-[var(--dim)]">选一个即下载并显示，下载过的会缓存、下次秒开。悬停桌宠可调大小 / 朝向 / 走路。</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {modelsState === "loading" ? (
                <div className="grid place-items-center py-10 text-sm text-[var(--dim)]">加载干员列表…</div>
              ) : modelsState === "error" ? (
                <div className="p-4 text-sm text-[var(--muted)]">干员列表加载失败，稍后再试。</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-[var(--muted)]">没有匹配的干员。</div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((m) => {
                    const isDl = downloaded.includes(m.key);
                    const isCur = current?.key === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => pick(m)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                          isCur ? "bg-violet-400/15 text-violet-300" : "text-[var(--text)] hover:bg-[var(--surface)]"
                        }`}
                      >
                        <span className="truncate">{m.name}</span>
                        <span className="shrink-0 text-[10px]">
                          {isCur ? "当前" : isDl ? <span className="text-emerald-400">已下载</span> : <span className="text-[var(--dim)]">下载</span>}
                        </span>
                      </button>
                    );
                  })}
                  {models.length > 80 && !query ? (
                    <p className="px-3 py-2 text-center text-[11px] text-[var(--dim)]">共 {models.length} 位干员，搜索名字找更多</p>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

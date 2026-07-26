"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Arknights Spine models (isHarryh/Ark-Models) via jsDelivr CDN (CORS-friendly).
const CDN = "https://cdn.jsdelivr.net/gh/isHarryh/Ark-Models@main";
// Spine 3.8 runtime (Arknights models are Spine 3.8), served over HTTPS via
// jsDelivr — the official esotericsoftware host redirects to an insecure http
// mirror that a https page blocks as mixed content.
const SPINE_JS = "https://cdn.jsdelivr.net/gh/EsotericSoftware/spine-runtimes@3.8/spine-ts/build/spine-player.js";
const SPINE_CSS = "https://cdn.jsdelivr.net/gh/EsotericSoftware/spine-runtimes@3.8/spine-ts/player/css/spine-player.css";

const HIDE_KEY = "lw-pet-hidden";
const IDLE_ANIMS = ["Relax", "Idle", "Sit", "Interact_1", "Interact"];
const INTERACT_ANIMS = ["Interact", "Interact_1", "Special", "Move"];

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
  const [hidden, setHidden] = useState(true);
  const [models, setModels] = useState<Model[]>([]);
  const [current, setCurrent] = useState<Model | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const idleRef = useRef<string>("Relax");
  const drag = useRef<{ startX: number; startY: number; ox: number; oy: number; moved: boolean } | null>(null);

  // restore hidden state
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  // load the model catalogue once
  useEffect(() => {
    let cancelled = false;
    (async () => {
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
          }));
        if (cancelled) return;
        setModels(list);
        const def = list.find((m) => m.key === "285_medic2") ?? list[Math.floor(list.length / 2)] ?? list[0];
        setCurrent(def ?? null);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // (re)initialise the spine player when the current model changes and pet is shown
  useEffect(() => {
    if (hidden || !current || !hostRef.current) return;
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
              idleRef.current = idle;
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
  }, [current, hidden]);

  const interact = useCallback(() => {
    const player = playerRef.current;
    if (!player?.animationState) return;
    try {
      const anims: string[] = player.skeleton.data.animations.map((a: { name: string }) => a.name);
      const act = INTERACT_ANIMS.find((n) => anims.includes(n) && n !== idleRef.current);
      if (!act) return;
      player.animationState.setAnimation(0, act, false);
      player.animationState.addAnimation(0, idleRef.current, true, 0);
    } catch {
      /* ignore */
    }
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = hostRef.current?.parentElement?.getBoundingClientRect();
    drag.current = {
      startX,
      startY,
      ox: rect?.left ?? 0,
      oy: rect?.top ?? 0,
      moved: false,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.current.moved = true;
    if (drag.current.moved) {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 120, drag.current.ox + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 120, drag.current.oy + dy)),
      });
    }
  }
  function onPointerUp() {
    if (drag.current && !drag.current.moved) interact();
    drag.current = null;
  }

  function randomModel() {
    if (models.length === 0) return;
    let next = current;
    for (let i = 0; i < 5 && (!next || next.key === current?.key); i++) {
      next = models[Math.floor(Math.random() * models.length)];
    }
    setCurrent(next);
  }

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* ignore */
    }
  }
  function summon() {
    setHidden(false);
    try {
      localStorage.setItem(HIDE_KEY, "0");
    } catch {
      /* ignore */
    }
  }

  if (hidden) {
    return (
      <button
        onClick={summon}
        title="召唤干员桌宠"
        className="fixed bottom-20 right-5 z-50 grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] bg-[var(--launcher)] text-lg shadow-lg transition hover:-translate-y-0.5 hover:border-violet-400/40"
      >
        🐧
      </button>
    );
  }

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { right: 16, bottom: 88 };

  return (
    <div className="group fixed z-40 select-none" style={style}>
      {/* controls */}
      <div className="mb-1 flex items-center justify-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button onClick={randomModel} title="换一个干员" className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-2 py-0.5 text-[10px] text-[var(--muted)] shadow">
          🔀
        </button>
        <button onClick={hide} title="收起" className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-2 py-0.5 text-[10px] text-[var(--muted)] shadow">
          ✕
        </button>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative h-[220px] w-[180px] cursor-grab touch-none active:cursor-grabbing"
      >
        <div ref={hostRef} className="h-full w-full" />
        {status === "loading" ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-[var(--dim)]">加载干员…</div>
        ) : status === "error" ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[10px] text-rose-400">模型加载失败</div>
        ) : null}
        {current ? (
          <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
            {current.name}
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import type { Sample } from "./protocol";

// Validated categorical palette (passes dataviz six-checks on both the dark
// #060911 and light #eef2f8 surfaces): setpoint amber, measured emerald.
// The controller-output panel is a separate single series (blue), so it never
// competes with the two above — no dual-axis chart.
const C_SETPOINT = "#c2610c";
const C_MEASURED = "#059669";
const C_OUTPUT = "#0284c7";

type SeriesKey = "setpoint" | "measured" | "output";

function niceExtent(min: number, max: number): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.1;
  return [min - pad, max + pad];
}

function Panel({
  samples,
  keys,
  colors,
  labels,
  height,
  tMin,
  tMax,
}: {
  samples: Sample[];
  keys: SeriesKey[];
  colors: Record<SeriesKey, string>;
  labels: Record<SeriesKey, string>;
  height: number;
  tMin: number;
  tMax: number;
}) {
  const W = 1000;
  const padL = 6;
  const padR = 92; // room for the direct label at the line end
  const padT = 12;
  const padB = 22;

  const { paths, yMin, yMax, ends } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of samples) {
      for (const k of keys) {
        const v = s[k];
        if (v != null && Number.isFinite(v)) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
    }
    const [yLo, yHi] = niceExtent(lo, hi);
    const span = tMax - tMin || 1;
    const yspan = yHi - yLo || 1;
    const xOf = (t: number) => padL + ((t - tMin) / span) * (W - padL - padR);
    const yOf = (v: number) => padT + (1 - (v - yLo) / yspan) * (height - padT - padB);

    const built: Record<string, string> = {};
    const endPts: { key: SeriesKey; x: number; y: number; v: number }[] = [];
    for (const k of keys) {
      let d = "";
      let penDown = false;
      let last: { x: number; y: number; v: number } | null = null;
      for (const s of samples) {
        const v = s[k];
        if (v == null || !Number.isFinite(v)) {
          penDown = false;
          continue;
        }
        const x = xOf(s.t);
        const y = yOf(v);
        d += `${penDown ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
        penDown = true;
        last = { x, y, v };
      }
      built[k] = d;
      if (last) endPts.push({ key: k, ...last });
    }
    return { paths: built, yMin: yLo, yMax: yHi, ends: endPts };
  }, [samples, keys, height, tMin, tMax]);

  const gridVals = [yMax, (yMax + yMin) / 2, yMin];

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
    >
      {/* horizontal grid + value ticks */}
      {gridVals.map((gv, i) => {
        const y = padT + (i / (gridVals.length - 1)) * (height - padT - padB);
        return (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={W - padR + 6}
              y={y + 3}
              fontSize={11}
              fill="var(--dim)"
              fontFamily="var(--font-geist-mono, monospace)"
            >
              {gv.toFixed(Math.abs(gv) >= 100 ? 0 : 1)}
            </text>
          </g>
        );
      })}

      {keys.map((k) => (
        <path
          key={k}
          d={paths[k]}
          fill="none"
          stroke={colors[k]}
          strokeWidth={k === "setpoint" ? 1.75 : 2}
          strokeDasharray={k === "setpoint" ? "6 5" : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* direct labels at each line's leading end (doubles as legend) */}
      {ends.map((e) => (
        <g key={e.key}>
          <circle cx={e.x} cy={e.y} r={3} fill={colors[e.key]} />
          <text
            x={Math.min(e.x + 6, W - padR + 4)}
            y={e.y - 6}
            fontSize={11}
            fontWeight={600}
            fill={colors[e.key]}
            fontFamily="var(--font-geist-mono, monospace)"
          >
            {labels[e.key]}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function ScopeChart({ samples }: { samples: Sample[] }) {
  const { tMin, tMax } = useMemo(() => {
    if (!samples.length) return { tMin: 0, tMax: 1 };
    return { tMin: samples[0].t, tMax: samples[samples.length - 1].t };
  }, [samples]);

  const hasOutput = useMemo(() => samples.some((s) => s.output != null), [samples]);

  if (!samples.length) {
    return (
      <div className="grid h-full w-full place-items-center text-sm text-[var(--dim)]">
        等待串口数据…（连接设备后波形会实时绘制）
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="min-h-0 flex-[3] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <Panel
          samples={samples}
          keys={["setpoint", "measured"]}
          colors={{ setpoint: C_SETPOINT, measured: C_MEASURED, output: C_OUTPUT }}
          labels={{ setpoint: "目标 SP", measured: "实测 PV", output: "输出" }}
          height={220}
          tMin={tMin}
          tMax={tMax}
        />
      </div>
      {hasOutput ? (
        <div className="min-h-0 flex-[1] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <Panel
            samples={samples}
            keys={["output"]}
            colors={{ setpoint: C_SETPOINT, measured: C_MEASURED, output: C_OUTPUT }}
            labels={{ setpoint: "目标 SP", measured: "实测 PV", output: "输出 U" }}
            height={96}
            tMin={tMin}
            tMax={tMax}
          />
        </div>
      ) : null}
    </div>
  );
}

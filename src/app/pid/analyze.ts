// Compute step-response metrics from a window of samples. These metrics are
// what we hand to the AI so it can reason about the loop without eyeballing a
// chart, and what we show the user as a scorecard.

import type { Sample } from "./protocol";

export type StepMetrics = {
  count: number;
  durationSec: number;
  setpoint: number | null;
  startValue: number | null;
  steadyValue: number | null;
  steadyError: number | null;
  overshootPct: number | null;
  peakValue: number | null;
  riseTimeSec: number | null;
  settlingTimeSec: number | null;
  /** RMS ripple around the steady value over the last third (oscillation). */
  steadyRipple: number | null;
  oscillating: boolean;
  /** A rough 0–100 quality score, higher is better. */
  score: number | null;
};

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function analyzeStep(samples: Sample[]): StepMetrics {
  const pts = samples.filter((s) => s.measured != null) as (Sample & {
    measured: number;
  })[];
  const base: StepMetrics = {
    count: pts.length,
    durationSec: 0,
    setpoint: null,
    startValue: null,
    steadyValue: null,
    steadyError: null,
    overshootPct: null,
    peakValue: null,
    riseTimeSec: null,
    settlingTimeSec: null,
    steadyRipple: null,
    oscillating: false,
    score: null,
  };
  if (pts.length < 4) return base;

  const t0 = pts[0].t;
  const tEnd = pts[pts.length - 1].t;
  base.durationSec = (tEnd - t0) / 1000;

  // Setpoint: last known value in the window (steps may change it).
  const spVals = pts.map((p) => p.setpoint).filter((v): v is number => v != null);
  const sp = spVals.length ? spVals[spVals.length - 1] : null;
  base.setpoint = sp;

  const start = pts[0].measured;
  base.startValue = start;

  // Steady state = mean over the final 25% of the window.
  const tailStart = Math.floor(pts.length * 0.75);
  const tail = pts.slice(tailStart).map((p) => p.measured);
  const steady = mean(tail);
  base.steadyValue = steady;

  // Ripple (RMS deviation) over the tail → oscillation indicator.
  const ripple = Math.sqrt(mean(tail.map((v) => (v - steady) ** 2)));
  base.steadyRipple = ripple;

  const span = sp != null ? sp - start : steady - start;
  const absSpan = Math.abs(span);
  base.oscillating = absSpan > 1e-9 && ripple > 0.03 * absSpan;

  if (sp != null) {
    base.steadyError = sp - steady;

    // Overshoot relative to the commanded step, sign-aware.
    const dir = Math.sign(span) || 1;
    let peak = pts[0].measured;
    for (const p of pts) if (dir * p.measured > dir * peak) peak = p.measured;
    base.peakValue = peak;
    if (absSpan > 1e-9) {
      const over = (dir * (peak - sp)) / absSpan;
      base.overshootPct = Math.max(0, over) * 100;
    }

    // Rise time: 10% → 90% of the commanded span.
    if (absSpan > 1e-9) {
      const lo = start + span * 0.1;
      const hi = start + span * 0.9;
      const tLo = crossTime(pts, lo, dir);
      const tHi = crossTime(pts, hi, dir);
      if (tLo != null && tHi != null && tHi >= tLo) {
        base.riseTimeSec = (tHi - tLo) / 1000;
      }
    }

    // Settling time: last moment the response leaves a ±2% band around sp.
    if (absSpan > 1e-9) {
      const band = 0.02 * absSpan;
      let lastOutside = t0;
      for (const p of pts) {
        if (Math.abs(p.measured - sp) > band) lastOutside = p.t;
      }
      base.settlingTimeSec = (lastOutside - t0) / 1000;
    }

    base.score = scoreResponse(base, absSpan);
  }

  return base;
}

function crossTime(
  pts: (Sample & { measured: number })[],
  level: number,
  dir: number,
): number | null {
  for (const p of pts) {
    if (dir * p.measured >= dir * level) return p.t;
  }
  return null;
}

function scoreResponse(m: StepMetrics, absSpan: number): number {
  // Penalise steady-state error, overshoot, slow settling and ripple.
  let score = 100;
  if (m.steadyError != null && absSpan > 1e-9) {
    score -= Math.min(40, (Math.abs(m.steadyError) / absSpan) * 100 * 2);
  }
  if (m.overshootPct != null) score -= Math.min(30, m.overshootPct);
  if (m.settlingTimeSec != null && m.durationSec > 0) {
    score -= Math.min(20, (m.settlingTimeSec / m.durationSec) * 20);
  }
  if (m.steadyRipple != null && absSpan > 1e-9) {
    score -= Math.min(20, (m.steadyRipple / absSpan) * 100);
  }
  return Math.max(0, Math.round(score));
}

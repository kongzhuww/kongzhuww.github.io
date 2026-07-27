// Serial protocol between the microcontroller (MCU) and this web tool.
//
// ── Telemetry: MCU → PC (one newline-terminated line per control tick) ──
// The parser auto-detects several friendly formats so most firmware "just
// works". The recommended, most explicit form is a tagged CSV line:
//
//     pid,<t_ms>,<setpoint>,<measured>,<output>[,<kp>,<ki>,<kd>]
//     e.g.  pid,1240,100.0,96.7,42.3,1.20,0.08,0.05
//
// Also accepted:
//   • Plain CSV whose columns follow the configured `columns` order
//       100.0,96.7,42.3            (columns = "sp,pv,out")
//   • key=value pairs             sp=100 pv=96.7 out=42.3 kp=1.2
//   • JSON object                 {"sp":100,"pv":96.7,"out":42.3}
//
// ── Commands: PC → MCU ──
// Editable templates (so they can match any firmware). Placeholders
// {kp} {ki} {kd} {sp} are substituted before sending. Defaults:
//   set gains    ->  "pid {kp} {ki} {kd}\n"
//   set setpoint ->  "sp {sp}\n"

export type Sample = {
  /** milliseconds since the tool started reading (monotonic) */
  t: number;
  setpoint: number | null;
  measured: number | null;
  output: number | null;
  kp?: number;
  ki?: number;
  kd?: number;
};

export type Gains = { kp: number; ki: number; kd: number };

/** A field the parser knows how to extract, used for CSV column mapping. */
export type FieldKey = "t" | "sp" | "pv" | "out" | "kp" | "ki" | "kd" | "_";

const ALIASES: Record<string, Exclude<FieldKey, "_">> = {
  t: "t",
  time: "t",
  ms: "t",
  sp: "sp",
  set: "sp",
  setpoint: "sp",
  target: "sp",
  ref: "sp",
  r: "sp",
  pv: "pv",
  measured: "pv",
  meas: "pv",
  actual: "pv",
  fb: "pv",
  feedback: "pv",
  y: "pv",
  out: "out",
  output: "out",
  u: "out",
  ctrl: "out",
  pwm: "out",
  duty: "out",
  kp: "kp",
  ki: "ki",
  kd: "kd",
};

// Matches the recommended tagged line `pid,<t_ms>,<sp>,<pv>,<out>[,<kp>,<ki>,<kd>]`.
// Trailing columns are ignored when the firmware sends fewer numbers, so this
// also handles `pid,<t_ms>,<sp>,<pv>,<out>` and, if the leading token is a tag
// like "pid", it is dropped before mapping. Firmware that sends bare `sp,pv,out`
// should set the column order accordingly.
export const DEFAULT_COLUMNS = "t,sp,pv,out,kp,ki,kd";

function toNum(raw: string): number | null {
  const v = Number(raw.trim());
  return Number.isFinite(v) ? v : null;
}

/**
 * Parse one telemetry line into a partial reading (without the timestamp,
 * which the caller stamps). Returns null when the line carries no numbers we
 * recognise (e.g. boot banners, debug prints).
 */
export function parseLine(
  line: string,
  columns: string = DEFAULT_COLUMNS,
): Omit<Sample, "t"> | null {
  const text = line.trim();
  if (!text) return null;

  const acc: Partial<Record<Exclude<FieldKey, "_">, number>> = {};

  // 1) JSON object
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        const field = ALIASES[k.toLowerCase()];
        if (field && typeof v === "number" && Number.isFinite(v)) acc[field] = v;
      }
      return finalize(acc);
    } catch {
      return null;
    }
  }

  // 2) key=value pairs (space / comma / semicolon separated)
  if (text.includes("=")) {
    for (const tok of text.split(/[\s,;]+/)) {
      const eq = tok.indexOf("=");
      if (eq <= 0) continue;
      const field = ALIASES[tok.slice(0, eq).toLowerCase()];
      const num = toNum(tok.slice(eq + 1));
      if (field && num !== null) acc[field] = num;
    }
    return finalize(acc);
  }

  // 3) positional CSV / whitespace-separated numbers, mapped via `columns`.
  const order = columns
    .split(/[\s,]+/)
    .map((c) => (ALIASES[c.toLowerCase()] ?? (c === "_" ? "_" : "_")) as FieldKey)
    .filter(Boolean);

  let tokens = text.split(/[\s,;]+/).filter(Boolean);
  // Drop a leading non-numeric tag such as "pid" or "$PID".
  if (tokens.length && toNum(tokens[0]) === null) tokens = tokens.slice(1);

  for (let i = 0; i < tokens.length && i < order.length; i++) {
    const field = order[i];
    if (field === "_") continue;
    const num = toNum(tokens[i]);
    if (num !== null) acc[field] = num;
  }
  return finalize(acc);
}

function finalize(
  acc: Partial<Record<Exclude<FieldKey, "_">, number>>,
): Omit<Sample, "t"> | null {
  if (acc.sp == null && acc.pv == null && acc.out == null) return null;
  return {
    setpoint: acc.sp ?? null,
    measured: acc.pv ?? null,
    output: acc.out ?? null,
    ...(acc.kp != null ? { kp: acc.kp } : {}),
    ...(acc.ki != null ? { ki: acc.ki } : {}),
    ...(acc.kd != null ? { kd: acc.kd } : {}),
  };
}

/** Substitute {kp}{ki}{kd}{sp} placeholders and normalise line endings. */
export function renderCommand(
  template: string,
  vars: { kp?: number; ki?: number; kd?: number; sp?: number },
): string {
  let out = template
    .replace(/\{kp\}/g, fmt(vars.kp))
    .replace(/\{ki\}/g, fmt(vars.ki))
    .replace(/\{kd\}/g, fmt(vars.kd))
    .replace(/\{sp\}/g, fmt(vars.sp));
  // Interpret escaped newlines typed into the settings field.
  out = out.replace(/\\r/g, "\r").replace(/\\n/g, "\n");
  if (!/[\r\n]$/.test(out)) out += "\n";
  return out;
}

function fmt(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return "0";
  // Trim to a sane number of decimals without trailing zeros.
  return String(Math.round(v * 1e4) / 1e4);
}

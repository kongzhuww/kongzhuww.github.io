"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ScopeChart from "./ScopeChart";
import { SerialLink, serialSupported, type SerialStatus } from "./serial";
import {
  DEFAULT_COLUMNS,
  parseLine,
  renderCommand,
  type Gains,
  type Sample,
} from "./protocol";
import { analyzeStep, type StepMetrics } from "./analyze";
import {
  requestTuning,
  testConnection,
  type AiConfig,
  type RoundRecord,
} from "./ai";

const LS_KEY = "pid-tuner-settings-v1";
const MAX_BUFFER = 6000;
const CHART_POINTS = 1200;

type Settings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  baud: number;
  columns: string;
  cmdGains: string;
  cmdSetpoint: string;
  setpoint: number;
  roundSec: number;
  maxRounds: number;
  autoApply: boolean;
  stepEachRound: boolean;
  notes: string;
};

const DEFAULTS: Settings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  baud: 115200,
  columns: DEFAULT_COLUMNS,
  cmdGains: "pid {kp} {ki} {kd}\\n",
  cmdSetpoint: "sp {sp}\\n",
  setpoint: 100,
  roundSec: 8,
  maxRounds: 6,
  autoApply: true,
  stepEachRound: true,
  notes: "",
};

type LogEntry = { kind: "rx" | "tx" | "sys" | "ai"; text: string };

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("aborted", "AbortError"));
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export default function PidTuner() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [gains, setGains] = useState<Gains>({ kp: 1, ki: 0.1, kd: 0.05 });
  const [status, setStatus] = useState<SerialStatus>("closed");
  const [statusDetail, setStatusDetail] = useState("");
  const [chartData, setChartData] = useState<Sample[]>([]);
  const [last, setLast] = useState<Sample | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [rounds, setRounds] = useState<RoundRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [supported, setSupported] = useState(true);
  const [showProtocol, setShowProtocol] = useState(false);

  const linkRef = useRef<SerialLink | null>(null);
  const bufRef = useRef<Sample[]>([]);
  const startRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const gainsRef = useRef<Gains>(gains);
  const settingsRef = useRef<Settings>(settings);
  const roundsRef = useRef<RoundRecord[]>(rounds);
  gainsRef.current = gains;
  settingsRef.current = settings;
  roundsRef.current = rounds;

  // ── load persisted settings ──
  useEffect(() => {
    setSupported(serialSupported());
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const pushLog = useCallback((entry: LogEntry) => {
    setLog((prev) => {
      const next = [...prev, entry];
      return next.length > 250 ? next.slice(-250) : next;
    });
  }, []);

  // ── chart refresh (throttled snapshot of the rolling buffer) ──
  useEffect(() => {
    const id = setInterval(() => {
      const buf = bufRef.current;
      setChartData(buf.length > CHART_POINTS ? buf.slice(-CHART_POINTS) : buf.slice());
    }, 100);
    return () => clearInterval(id);
  }, []);

  const nowRel = () => performance.now() - startRef.current;

  const handleLine = useCallback(
    (line: string) => {
      const parsed = parseLine(line, settingsRef.current.columns);
      if (!parsed) {
        pushLog({ kind: "rx", text: line });
        return;
      }
      const sample: Sample = { t: nowRel(), ...parsed };
      const buf = bufRef.current;
      buf.push(sample);
      if (buf.length > MAX_BUFFER) buf.splice(0, buf.length - MAX_BUFFER);
      setLast(sample);
      // Note: any kp/ki/kd the firmware reports are plotted/logged but do NOT
      // overwrite the editable Kp/Ki/Kd fields — those stay under user/AI
      // control so streaming telemetry can't clobber a value mid-edit.
    },
    [pushLog],
  );

  async function connect() {
    try {
      const link = new SerialLink(handleLine, (s, detail) => {
        setStatus(s);
        setStatusDetail(detail ?? "");
        if (s === "error") pushLog({ kind: "sys", text: `串口错误：${detail ?? ""}` });
      });
      linkRef.current = link;
      startRef.current = performance.now();
      bufRef.current = [];
      await link.connect(settings.baud);
      pushLog({ kind: "sys", text: `已连接串口，波特率 ${settings.baud}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus("error");
      setStatusDetail(msg);
      pushLog({ kind: "sys", text: `连接失败：${msg}` });
    }
  }

  async function disconnect() {
    stopAuto();
    await linkRef.current?.disconnect();
    linkRef.current = null;
    pushLog({ kind: "sys", text: "已断开串口" });
  }

  const sendRaw = useCallback(
    async (text: string) => {
      if (!linkRef.current?.isOpen) {
        pushLog({ kind: "sys", text: "串口未连接，无法发送" });
        return;
      }
      await linkRef.current.send(text);
      pushLog({ kind: "tx", text: text.replace(/\r/g, "\\r").replace(/\n/g, "\\n") });
    },
    [pushLog],
  );

  const sendGains = useCallback(
    async (g: Gains) => {
      await sendRaw(renderCommand(settingsRef.current.cmdGains, g));
    },
    [sendRaw],
  );

  const sendSetpoint = useCallback(
    async (sp: number) => {
      await sendRaw(renderCommand(settingsRef.current.cmdSetpoint, { sp }));
    },
    [sendRaw],
  );

  const cfg = (): AiConfig => ({
    baseUrl: settingsRef.current.baseUrl,
    apiKey: settingsRef.current.apiKey,
    model: settingsRef.current.model,
  });

  async function onTestAi() {
    setBusy(true);
    setAiStatus("测试 AI 接口中…");
    try {
      const reply = await testConnection(cfg());
      setAiStatus(`AI 接口正常：${reply.slice(0, 40)}`);
      pushLog({ kind: "ai", text: `接口测试成功：${reply.slice(0, 80)}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiStatus(`AI 接口失败：${msg}`);
      pushLog({ kind: "ai", text: `接口测试失败：${msg}` });
    } finally {
      setBusy(false);
    }
  }

  /** Collect one window, analyse it and ask the AI for new gains. */
  async function runOneRound(roundNo: number, signal: AbortSignal): Promise<boolean> {
    const s = settingsRef.current;
    if (s.stepEachRound) {
      setAiStatus(`第 ${roundNo} 轮：发送阶跃激励…`);
      await sendSetpoint(0);
      await sleep(Math.min(1500, s.roundSec * 200), signal);
      await sendSetpoint(s.setpoint);
    }
    const roundStartT = nowRel();
    setAiStatus(`第 ${roundNo} 轮：采集 ${s.roundSec}s 阶跃响应…`);
    await sleep(s.roundSec * 1000, signal);

    const windowSamples = bufRef.current.filter((x) => x.t >= roundStartT);
    const metrics: StepMetrics = analyzeStep(windowSamples);
    if (metrics.count < 4) {
      setAiStatus("本轮采集到的数据太少，请检查串口格式或波特率");
      pushLog({ kind: "sys", text: "数据点不足，跳过 AI 分析" });
      return false;
    }

    setAiStatus(`第 ${roundNo} 轮：AI 分析中…`);
    const before = gainsRef.current;
    const advice = await requestTuning(cfg(), before, metrics, roundsRef.current, s.notes, signal);

    const record: RoundRecord = { round: roundNo, gains: before, metrics, advice };
    roundsRef.current = [...roundsRef.current, record];
    setRounds(roundsRef.current);
    pushLog({
      kind: "ai",
      text: `第${roundNo}轮 评分${metrics.score ?? "-"} → Kp=${advice.kp} Ki=${advice.ki} Kd=${advice.kd}｜${advice.assessment}`,
    });

    if (s.autoApply) {
      const newGains: Gains = { kp: advice.kp, ki: advice.ki, kd: advice.kd };
      setGains(newGains);
      await sendGains(newGains);
    }
    if (advice.nextSetpoint != null) {
      setSettings((p) => ({ ...p, setpoint: advice.nextSetpoint as number }));
    }
    return advice.converged;
  }

  async function tuneOnce() {
    if (busy || autoRunning) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    try {
      await runOneRound(roundsRef.current.length + 1, ctrl.signal);
      setAiStatus("单轮整定完成");
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setAiStatus(`整定出错：${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  async function startAuto() {
    if (busy || autoRunning) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAutoRunning(true);
    setBusy(true);
    try {
      const max = settingsRef.current.maxRounds;
      for (let i = 0; i < max; i++) {
        if (ctrl.signal.aborted) break;
        const converged = await runOneRound(roundsRef.current.length + 1, ctrl.signal);
        if (converged) {
          setAiStatus(`AI 判定已收敛，自动整定在第 ${i + 1} 轮结束 🎉`);
          break;
        }
        if (i === max - 1) setAiStatus(`达到最大轮数（${max}），自动整定结束`);
        await sleep(600, ctrl.signal);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setAiStatus(`自动整定出错：${err instanceof Error ? err.message : String(err)}`);
      } else {
        setAiStatus("自动整定已停止");
      }
    } finally {
      setAutoRunning(false);
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stopAuto() {
    abortRef.current?.abort();
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      linkRef.current?.disconnect();
    };
  }, []);

  const lastRound = rounds[rounds.length - 1];
  const connected = status === "open";

  return (
    <main className="min-h-screen text-[var(--text)]">
      <Header connected={connected} statusDetail={statusDetail} />

      {!supported ? (
        <div className="mx-auto mt-4 max-w-7xl px-4">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            当前浏览器不支持 Web Serial API。请使用桌面版 <b>Chrome / Edge</b>（且页面需通过 HTTPS 或
            localhost 打开）后重试。
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[370px_1fr]">
        {/* ── left: configuration ── */}
        <div className="space-y-4">
          <Card title="AI 接口" hint="用你自己的 Base URL 和 API Key（保存在本地浏览器）">
            <Field label="Base URL">
              <input
                className="pid-input"
                value={settings.baseUrl}
                onChange={(e) => setSettings((p) => ({ ...p, baseUrl: e.target.value }))}
                placeholder="https://api.openai.com/v1"
              />
            </Field>
            <Field label="API Key">
              <input
                className="pid-input"
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings((p) => ({ ...p, apiKey: e.target.value }))}
                placeholder="sk-..."
              />
            </Field>
            <Field label="模型 Model">
              <input
                className="pid-input"
                value={settings.model}
                onChange={(e) => setSettings((p) => ({ ...p, model: e.target.value }))}
                placeholder="gpt-4o-mini / deepseek-chat …"
              />
            </Field>
            <button className="pid-btn w-full" disabled={busy} onClick={onTestAi}>
              测试 AI 接口
            </button>
            {aiStatus ? <p className="text-xs text-[var(--muted)]">{aiStatus}</p> : null}
          </Card>

          <Card title="串口连接" hint="连接单片机（Web Serial）">
            <Field label="波特率">
              <select
                className="pid-input"
                value={settings.baud}
                onChange={(e) => setSettings((p) => ({ ...p, baud: Number(e.target.value) }))}
              >
                {[9600, 19200, 38400, 57600, 115200, 230400, 460800].map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="CSV 列顺序" hint="逗号/空格分隔的数据按此映射">
              <input
                className="pid-input"
                value={settings.columns}
                onChange={(e) => setSettings((p) => ({ ...p, columns: e.target.value }))}
                placeholder="t,sp,pv,out"
              />
            </Field>
            {connected ? (
              <button className="pid-btn pid-btn-danger w-full" onClick={disconnect}>
                断开串口
              </button>
            ) : (
              <button
                className="pid-btn pid-btn-primary w-full"
                disabled={!supported}
                onClick={connect}
              >
                连接串口
              </button>
            )}
          </Card>

          <Card title="PID 参数" hint="手动微调或写入设备">
            <div className="grid grid-cols-3 gap-2">
              {(["kp", "ki", "kd"] as const).map((k) => (
                <Field key={k} label={k.toUpperCase()}>
                  <input
                    className="pid-input text-center"
                    type="number"
                    step="0.01"
                    value={gains[k]}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setGains((p) => ({ ...p, [k]: Number.isFinite(v) ? v : p[k] }));
                    }}
                  />
                </Field>
              ))}
            </div>
            <button
              className="pid-btn w-full"
              disabled={!connected}
              onClick={() => sendGains(gains)}
            >
              写入 PID 到设备
            </button>
            <div className="flex items-end gap-2">
              <Field label="目标值 Setpoint">
                <input
                  className="pid-input"
                  type="number"
                  value={settings.setpoint}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, setpoint: Number(e.target.value) }))
                  }
                />
              </Field>
              <button
                className="pid-btn mb-0.5 shrink-0"
                disabled={!connected}
                onClick={() => sendSetpoint(settings.setpoint)}
              >
                设定
              </button>
            </div>
          </Card>

          <Card title="AI 自动整定" hint="AI 看一轮响应 → 调 PID → 循环">
            <div className="grid grid-cols-2 gap-2">
              <Field label="每轮采集(秒)">
                <input
                  className="pid-input"
                  type="number"
                  min={2}
                  value={settings.roundSec}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, roundSec: Number(e.target.value) || 8 }))
                  }
                />
              </Field>
              <Field label="最大轮数">
                <input
                  className="pid-input"
                  type="number"
                  min={1}
                  value={settings.maxRounds}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, maxRounds: Number(e.target.value) || 6 }))
                  }
                />
              </Field>
            </div>
            <Toggle
              checked={settings.autoApply}
              onChange={(v) => setSettings((p) => ({ ...p, autoApply: v }))}
              label="自动把 AI 建议写入设备"
            />
            <Toggle
              checked={settings.stepEachRound}
              onChange={(v) => setSettings((p) => ({ ...p, stepEachRound: v }))}
              label="每轮开始发送阶跃激励 (0 → 目标)"
            />
            <Field label="给 AI 的补充说明（可选）">
              <textarea
                className="pid-input h-16 resize-none"
                value={settings.notes}
                onChange={(e) => setSettings((p) => ({ ...p, notes: e.target.value }))}
                placeholder="例如：这是温度控制，响应慢、允许 1℃ 误差…"
              />
            </Field>
            <div className="flex gap-2">
              <button
                className="pid-btn flex-1"
                disabled={!connected || busy}
                onClick={tuneOnce}
              >
                AI 调一轮
              </button>
              {autoRunning ? (
                <button className="pid-btn pid-btn-danger flex-1" onClick={stopAuto}>
                  停止
                </button>
              ) : (
                <button
                  className="pid-btn pid-btn-primary flex-1"
                  disabled={!connected || busy}
                  onClick={startAuto}
                >
                  开始自动整定
                </button>
              )}
            </div>
          </Card>

          <ProtocolCard open={showProtocol} onToggle={() => setShowProtocol((v) => !v)} />
        </div>

        {/* ── right: live view ── */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="目标 SP" value={fmtVal(last?.setpoint ?? settings.setpoint)} color="#c2610c" />
            <Stat label="实测 PV" value={fmtVal(last?.measured)} color="#059669" />
            <Stat label="输出 U" value={fmtVal(last?.output)} color="#0284c7" />
            <Stat
              label="上轮评分"
              value={lastRound?.metrics.score != null ? String(lastRound.metrics.score) : "—"}
              color="#7c3aed"
            />
          </div>

          <Card title="实时波形" hint="上：目标 vs 实测 · 下：控制器输出">
            <div className="h-[340px] w-full">
              <ScopeChart samples={chartData} />
            </div>
          </Card>

          {lastRound ? (
            <Card title={`最新一轮分析（第 ${lastRound.round} 轮）`}>
              <MetricsGrid m={lastRound.metrics} />
              {lastRound.advice ? (
                <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                      AI 建议 Kp={lastRound.advice.kp} Ki={lastRound.advice.ki} Kd={lastRound.advice.kd}
                    </span>
                    <span className="text-xs text-[var(--dim)]">
                      信心 {(lastRound.advice.confidence * 100).toFixed(0)}%
                      {lastRound.advice.converged ? " · 已收敛" : ""}
                    </span>
                  </div>
                  <p className="text-[var(--text)]">{lastRound.advice.assessment}</p>
                  {lastRound.advice.reasoning ? (
                    <p className="mt-1 text-[var(--muted)]">{lastRound.advice.reasoning}</p>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}

          {rounds.length ? (
            <Card title="整定历史" hint={`${rounds.length} 轮`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[var(--dim)]">
                    <tr>
                      {["轮", "Kp", "Ki", "Kd", "超调%", "稳态误差", "调节时间s", "评分"].map((h) => (
                        <th key={h} className="px-2 py-1 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {rounds.map((r) => (
                      <tr key={r.round} className="border-t border-[var(--border)]">
                        <td className="px-2 py-1">{r.round}</td>
                        <td className="px-2 py-1">{r.gains.kp}</td>
                        <td className="px-2 py-1">{r.gains.ki}</td>
                        <td className="px-2 py-1">{r.gains.kd}</td>
                        <td className="px-2 py-1">{fmtVal(r.metrics.overshootPct)}</td>
                        <td className="px-2 py-1">{fmtVal(r.metrics.steadyError)}</td>
                        <td className="px-2 py-1">{fmtVal(r.metrics.settlingTimeSec)}</td>
                        <td className="px-2 py-1 font-semibold text-[var(--heading)]">
                          {r.metrics.score ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          <Card title="串口 / AI 日志">
            <LogView log={log} />
            <RawSender onSend={sendRaw} disabled={!connected} />
          </Card>
        </div>
      </div>
    </main>
  );
}

/* ───────────────────────── small presentational pieces ───────────────────────── */

function Header({
  connected,
  statusDetail,
}: {
  connected: boolean;
  statusDetail: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--header)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--heading)] text-sm font-black text-[var(--panel)]">
            PID
          </span>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400/80">
              Serial · AI Auto-Tune
            </p>
            <h1 className="text-base font-semibold text-[var(--heading)]">PID 串口调试助手</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium"
            title={statusDetail}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: connected ? "#34d399" : "#64748b" }}
            />
            {connected ? "串口已连接" : "未连接"}
          </span>
          <Link
            href="/"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--border-strong)]"
          >
            ← 返回首页
          </Link>
        </div>
      </div>
    </header>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--heading)]">{title}</h2>
        {hint ? <span className="text-[11px] text-[var(--dim)]">{hint}</span> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
        {label}
        {hint ? <span className="text-[10px] text-[var(--dim)]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-emerald-500"
      />
      {label}
    </label>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-1 h-1 w-8 rounded-full" style={{ backgroundColor: color }} />
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-mono text-2xl font-bold text-[var(--heading)] tabular-nums">{value}</p>
    </div>
  );
}

function MetricsGrid({ m }: { m: StepMetrics }) {
  const items: [string, string][] = [
    ["超调", m.overshootPct != null ? `${m.overshootPct.toFixed(1)}%` : "—"],
    ["稳态误差", fmtVal(m.steadyError)],
    ["上升时间", m.riseTimeSec != null ? `${m.riseTimeSec.toFixed(2)}s` : "—"],
    ["调节时间", m.settlingTimeSec != null ? `${m.settlingTimeSec.toFixed(2)}s` : "—"],
    ["稳态值", fmtVal(m.steadyValue)],
    ["纹波RMS", fmtVal(m.steadyRipple)],
    ["振荡", m.oscillating ? "是" : "否"],
    ["采样点", String(m.count)],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
          <p className="text-[10px] text-[var(--dim)]">{k}</p>
          <p className="font-mono text-sm font-semibold text-[var(--text)]">{v}</p>
        </div>
      ))}
    </div>
  );
}

function LogView({ log }: { log: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);
  const color: Record<LogEntry["kind"], string> = {
    rx: "var(--muted)",
    tx: "#0284c7",
    sys: "var(--dim)",
    ai: "#059669",
  };
  const tag: Record<LogEntry["kind"], string> = { rx: "RX", tx: "TX", sys: "··", ai: "AI" };
  return (
    <div
      ref={ref}
      className="h-44 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] p-2 font-mono text-[11px] leading-5"
    >
      {log.length === 0 ? (
        <p className="text-[var(--dim)]">日志为空。连接串口后这里会显示收发数据。</p>
      ) : (
        log.map((e, i) => (
          <div key={i} className="flex gap-2">
            <span className="shrink-0" style={{ color: color[e.kind] }}>
              {tag[e.kind]}
            </span>
            <span className="min-w-0 break-all text-[var(--text)]">{e.text}</span>
          </div>
        ))
      )}
    </div>
  );
}

function RawSender({
  onSend,
  disabled,
}: {
  onSend: (t: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSend(text.endsWith("\n") ? text : `${text}\n`);
        setText("");
      }}
    >
      <input
        className="pid-input flex-1 font-mono"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="手动发送一行命令，回车发送"
        disabled={disabled}
      />
      <button className="pid-btn shrink-0" disabled={disabled} type="submit">
        发送
      </button>
    </form>
  );
}

function ProtocolCard({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={onToggle}
      >
        <h2 className="text-sm font-semibold text-[var(--heading)]">📡 串口协议约定</h2>
        <span className="text-[var(--dim)]">{open ? "收起 ▲" : "展开 ▼"}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-3 text-xs leading-5 text-[var(--muted)]">
          <div>
            <p className="mb-1 font-semibold text-[var(--text)]">上行（单片机 → 网页），每个控制周期一行：</p>
            <pre className="overflow-x-auto rounded-lg bg-[var(--panel)] p-2 text-[var(--text)]">
{`pid,<t_ms>,<setpoint>,<measured>,<output>
例:  pid,1240,100.0,96.7,42.3`}
            </pre>
            <p className="mt-1">也兼容：纯 CSV（按上面“列顺序”映射）、<code>sp=100 pv=96.7 out=42.3</code> 键值对、或 JSON <code>{`{"sp":100,"pv":96.7,"out":42.3}`}</code>。可选带上 kp/ki/kd。</p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-[var(--text)]">下行（网页 → 单片机）命令模板：</p>
            <pre className="overflow-x-auto rounded-lg bg-[var(--panel)] p-2 text-[var(--text)]">
{`设定参数:  pid {kp} {ki} {kd}\\n
设定目标:  sp {sp}\\n`}
            </pre>
            <p className="mt-1">
              占位符 <code>{"{kp} {ki} {kd} {sp}"}</code> 会被替换。固件里按此解析即可，模板可在“串口连接”里自定义。
            </p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-[var(--text)]">Arduino 示例（上行）：</p>
            <pre className="overflow-x-auto rounded-lg bg-[var(--panel)] p-2 text-[var(--text)]">
{`Serial.print("pid,");   Serial.print(millis());
Serial.print(",");      Serial.print(setpoint);
Serial.print(",");      Serial.print(measured);
Serial.print(",");      Serial.println(output);`}
            </pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function fmtVal(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  return (Math.round(v * 100) / 100).toString();
}

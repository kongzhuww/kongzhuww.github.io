// OpenAI-compatible chat client + PID-tuning prompt.
// Everything runs in the browser against the user's own Base URL + API key;
// no key ever touches a server we control.

import type { Gains } from "./protocol";
import type { StepMetrics } from "./analyze";

export type AiConfig = { baseUrl: string; apiKey: string; model: string };

export type TuneAdvice = {
  kp: number;
  ki: number;
  kd: number;
  assessment: string;
  reasoning: string;
  converged: boolean;
  confidence: number;
  nextSetpoint?: number;
};

export type RoundRecord = {
  round: number;
  gains: Gains;
  metrics: StepMetrics;
  advice?: TuneAdvice;
};

/** Turn a user-supplied Base URL into a chat-completions endpoint. */
export function chatEndpoint(baseUrl: string): string {
  const b = baseUrl.trim().replace(/\/+$/, "");
  if (!b) throw new Error("请先填写 Base URL");
  if (b.endsWith("/chat/completions")) return b;
  // Common convention: a trailing "#" means "use this URL verbatim".
  if (baseUrl.trim().endsWith("#")) return baseUrl.trim().slice(0, -1);
  return `${b}/chat/completions`;
}

const SYSTEM_PROMPT = `你是一位资深的控制系统工程师，专精 PID 参数整定（tuning）。
你会收到某个闭环系统一轮阶跃响应的量化指标和当前 PID 参数，请据此给出下一组更优的 Kp/Ki/Kd。

整定原则（经验法则）：
- 稳态误差大 / 收敛慢 → 适当增大 Ki（或 Kp）。
- 超调大 / 振荡 → 减小 Kp 或 Ki，或增大 Kd 抑制。
- 上升太慢 → 增大 Kp。
- 高频抖动明显 → Kd 可能过大或存在噪声，适当减小 Kd。
- 每次调整幅度要克制（通常 ±30% 以内），避免系统发散。

只输出一个 JSON 对象，不要包含解释性文字或 markdown 代码块，字段如下：
{
  "kp": number,            // 建议的新 Kp
  "ki": number,            // 建议的新 Ki
  "kd": number,            // 建议的新 Kd
  "assessment": string,    // 一句话评价当前这轮响应（中文）
  "reasoning": string,     // 为什么这样调（中文，简短）
  "converged": boolean,    // 若响应已足够好、无需再调则为 true
  "confidence": number,    // 0~1，对本次建议的信心
  "nextSetpoint": number   // 可选：建议下一轮用于测试的目标值
}`;

function buildUserPrompt(
  gains: Gains,
  metrics: StepMetrics,
  history: RoundRecord[],
  notes: string,
): string {
  const payload = {
    当前参数: gains,
    本轮指标: {
      设定值_setpoint: metrics.setpoint,
      起始值: round(metrics.startValue),
      稳态值: round(metrics.steadyValue),
      稳态误差: round(metrics.steadyError),
      超调百分比: round(metrics.overshootPct),
      峰值: round(metrics.peakValue),
      上升时间_s: round(metrics.riseTimeSec),
      调节时间_s: round(metrics.settlingTimeSec),
      稳态纹波RMS: round(metrics.steadyRipple),
      是否振荡: metrics.oscillating,
      采样点数: metrics.count,
      窗口时长_s: round(metrics.durationSec),
      质量评分_0_100: metrics.score,
    },
    历史轮次: history.slice(-4).map((r) => ({
      round: r.round,
      gains: r.gains,
      score: r.metrics.score,
      overshoot: round(r.metrics.overshootPct),
      steadyError: round(r.metrics.steadyError),
    })),
    补充说明: notes || "无",
  };
  return `请分析下面这轮 PID 阶跃响应数据并给出改进后的参数（严格输出 JSON）：\n\n${JSON.stringify(
    payload,
    null,
    2,
  )}`;
}

function round(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round(v * 1e4) / 1e4;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Low-level chat call. Returns the assistant message text. */
export async function chat(
  cfg: AiConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(chatEndpoint(cfg.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model || "gpt-4o-mini",
      messages,
      temperature: 0.3,
    }),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI 接口返回 ${res.status}：${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回内容为空");
  return content;
}

/** Extract the first balanced JSON object from a model response. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start < 0) throw new Error("AI 未返回 JSON");
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === "{") depth++;
    else if (candidate[i] === "}") {
      depth--;
      if (depth === 0) return JSON.parse(candidate.slice(start, i + 1));
    }
  }
  throw new Error("AI 返回的 JSON 不完整");
}

/** Ask the AI for one round of tuning advice. */
export async function requestTuning(
  cfg: AiConfig,
  gains: Gains,
  metrics: StepMetrics,
  history: RoundRecord[],
  notes: string,
  signal?: AbortSignal,
): Promise<TuneAdvice> {
  const text = await chat(
    cfg,
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(gains, metrics, history, notes) },
    ],
    signal,
  );
  const obj = extractJson(text) as Record<string, unknown>;
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    kp: num(obj.kp, gains.kp),
    ki: num(obj.ki, gains.ki),
    kd: num(obj.kd, gains.kd),
    assessment: typeof obj.assessment === "string" ? obj.assessment : "",
    reasoning: typeof obj.reasoning === "string" ? obj.reasoning : "",
    converged: obj.converged === true,
    confidence: num(obj.confidence, 0),
    nextSetpoint:
      typeof obj.nextSetpoint === "number" && Number.isFinite(obj.nextSetpoint)
        ? obj.nextSetpoint
        : undefined,
  };
}

/** Quick round-trip used by the "测试连接" button. */
export async function testConnection(cfg: AiConfig): Promise<string> {
  return chat(cfg, [
    { role: "user", content: "回复两个字：正常" },
  ]);
}

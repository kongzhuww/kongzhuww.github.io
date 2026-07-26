"use client";

import { useMemo, useState } from "react";

type Note = {
  q: string;
  a: string;
};

type Section = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  notes: Note[];
};

// 大模型知识手册 —— 由对话沉淀，专门放在这个小窗里随时复习。
const SECTIONS: Section[] = [
  {
    id: "arch",
    icon: "🧱",
    title: "底层架构：Transformer",
    subtitle: "一切的基石",
    notes: [
      { q: "Attention 注意力机制", a: "核心。每个词都会“看”句子里所有其他词，算出谁跟谁相关。名言：Attention is All You Need（2017）。" },
      { q: "Token 词元", a: "模型不认字只认 token。中文一字≈1-2 token，英文一词≈1 token。付费、上下文长度都按 token 算。" },
      { q: "Embedding 词向量", a: "把 token 变成一串数字，意思相近向量也相近。经典：国王 - 男人 + 女人 ≈ 女王。" },
      { q: "参数 Parameters", a: "模型里几千亿个可调的“旋钮”。7B = 70 亿参数。越多≈越聪明但越贵。" },
      { q: "自回归 Autoregressive", a: "本质是一个字一个字地猜下一个词。你看到的所有回答都是“预测下一个 token”接龙出来的。" },
    ],
  },
  {
    id: "train",
    icon: "🏋️",
    title: "训练三部曲",
    subtitle: "模型怎么变聪明",
    notes: [
      { q: "① 预训练 Pre-training", a: "喂海量互联网文本，学“预测下一个词”。让模型有了知识和语言能力，烧钱最多（几千万美元）。" },
      { q: "② 监督微调 SFT", a: "用人写的优质问答，教它怎么当个有用的助手。" },
      { q: "③ 对齐 RLHF / DPO", a: "用人类偏好打分，让它有用、诚实、无害。这就是 ChatGPT 好用的原因——不是更懂，是更听话、会说人话。" },
    ],
  },
  {
    id: "scaling",
    icon: "📈",
    title: "Scaling Law 缩放定律",
    subtitle: "行业圣经",
    notes: [
      { q: "核心结论", a: "模型能力 ≈ 随“参数量 × 数据量 × 算力”平滑增长。大力真的出奇迹。" },
      { q: "涌现能力 Emergent", a: "某些能力（如推理）在模型小时完全没有，过了某个规模突然出现，像开窍一样。" },
    ],
  },
  {
    id: "infer",
    icon: "🎛️",
    title: "推理/生成阶段",
    subtitle: "你用它时发生了什么",
    notes: [
      { q: "上下文窗口 Context Window", a: "一次能“记住”的 token 上限。超了就忘前面的——长对话“失忆”的原因。超出的内容不是模糊，是彻底看不见。" },
      { q: "Temperature 温度", a: "控制随机性。低=保守稳定，高=天马行空。要严谨设低，要创意设高。本质是在“取概率最高”和“按概率随机抽”之间调节。" },
      { q: "Top-p / Top-k", a: "控制“从多少候选词里挑”的旋钮。" },
      { q: "KV Cache", a: "加速技巧，避免重复计算，让长文本生成变快。" },
      { q: "幻觉 Hallucination", a: "会一本正经地胡编。因为它本质是猜下一个最像的词，不是查数据库。最大的坑。" },
    ],
  },
  {
    id: "boost",
    icon: "🧠",
    title: "让模型变强的用法",
    subtitle: "Prompt 工程 & 增强",
    notes: [
      { q: "上下文学习 In-Context Learning", a: "不用重新训练，在提示词里给几个例子，它就现学现用。" },
      { q: "思维链 CoT", a: "让它“一步一步想”，推理能力大幅提升。神咒：Let's think step by step。" },
      { q: "RAG 检索增强生成", a: "先去知识库/文档里查资料，再基于资料回答。治幻觉、接私有数据的主流方案。" },
      { q: "工具调用 Function Calling", a: "让模型会调计算器、搜索、API。从“会聊天”变成“会干活”。" },
      { q: "Agent 智能体", a: "自己规划 → 调工具 → 看结果 → 再规划，自主完成多步任务。" },
      { q: "微调 Fine-tuning", a: "用你自己的数据再训练一版，让它更懂你的领域。" },
      { q: "Prompt 黄金公式", a: "角色 + 任务 + 上下文 + 约束 + 示例 + 输出格式。写好这 6 块，效果翻倍。" },
    ],
  },
  {
    id: "frontier",
    icon: "🚀",
    title: "前沿架构与趋势",
    subtitle: "2024-2026 热点",
    notes: [
      { q: "MoE 混合专家", a: "内部分很多“专家”，每次只激活一部分。又大又快又省（DeepSeek、Mixtral）。" },
      { q: "多模态 Multimodal", a: "不只文字，还能看图、听声、看视频。GPT-4o、Gemini、Claude 都是。" },
      { q: "推理模型 Reasoning Models", a: "如 o 系列、DeepSeek-R1，回答前先“深度思考”很久，专攻数学/代码/复杂推理。" },
      { q: "蒸馏 Distillation", a: "用大模型教小模型，让小模型也很能打、能塞进手机。AI 平民化的关键。" },
      { q: "量化 Quantization", a: "把参数精度降低（16 位→4 位），模型变小、能本地跑。" },
    ],
  },
  {
    id: "pitfall",
    icon: "⚠️",
    title: "必须知道的阴暗面",
    subtitle: "三大坑 + 铁律",
    notes: [
      { q: "幻觉", a: "会编造事实，尤其数字、日期、人名、引用、法律医疗。铁律：信任但验证。" },
      { q: "知识截止 Knowledge Cutoff", a: "训练数据到某个日期为止，之后的事不知道。所以要联网/RAG。" },
      { q: "越狱 & 对齐税", a: "安全限制会略微降低能力；有人专门设计提示词绕过限制（Jailbreak）。" },
      { q: "偏见 Bias", a: "训练数据里的偏见会被模型继承。" },
    ],
  },
  {
    id: "deep-attn",
    icon: "🔍",
    title: "深挖 · Attention 怎么算",
    subtitle: "Q / K / V 三件套",
    notes: [
      { q: "三件套", a: "每个词生成 Q（我在找什么）、K（我是什么）、V（我的内容）。用我的 Q 和所有词的 K 做点积→相关分数→softmax→加权求和所有 V。" },
      { q: "一句话", a: "我拿着问题(Q)，去问句子里每个词(K)，谁答得上就多听谁的内容(V)。" },
      { q: "Multi-Head 多头", a: "同时开 8/16 个注意力头，各看一个角度（语法、指代、情感…），最后拼起来。" },
      { q: "复杂度 O(n²)", a: "句子翻倍计算翻 4 倍——长文本又慢又贵的根本原因（FlashAttention 等在攻克）。" },
    ],
  },
  {
    id: "deep-rlhf",
    icon: "🎯",
    title: "深挖 · RLHF 怎么调乖",
    subtitle: "驯化三步",
    notes: [
      { q: "① SFT", a: "人类写好几万条理想回答，教模型“助手该长这样”。" },
      { q: "② 奖励模型 Reward Model", a: "对同一问题生成多个回答让人类排序，训练一个像人一样评判好坏的打分器。" },
      { q: "③ 强化学习 PPO", a: "主模型生成→奖励模型打分→分高强化、分低抑制，反复迭代。" },
      { q: "新方案 DPO", a: "跳过奖励模型，直接用人类偏好优化，更简单更稳定，现在很主流。" },
    ],
  },
  {
    id: "deep-agent",
    icon: "🤖",
    title: "深挖 · Agent 工作循环",
    subtitle: "ReAct 范式",
    notes: [
      { q: "核心循环", a: "目标 → 思考 → 行动(调工具) → 观察 → 回到思考，直到完成。" },
      { q: "ReAct", a: "Thought(该做什么) → Action(调工具) → Observation(拿结果) → 循环。" },
      { q: "四大组件", a: "规划(拆步骤) + 记忆(短期=上下文，长期=外部库) + 工具(搜索/代码/API) + 反思(自我纠错重试)。" },
    ],
  },
  {
    id: "deep-hallu",
    icon: "🩺",
    title: "深挖 · 幻觉怎么治",
    subtitle: "工程组合拳",
    notes: [
      { q: "为什么会编", a: "本质是猜最像的下一个词，追求“听起来对”而非“事实对”；且它不知道自己不知道。" },
      { q: "治法", a: "① RAG 照资料答（最有效）② 联网搜索 ③ 要求引用来源 ④ 降低 Temperature ⑤ 明确说不知道就说不知道 ⑥ 多次采样投票 ⑦ 另一个模型/人当事实核查。" },
    ],
  },
  {
    id: "oneline",
    icon: "🗺️",
    title: "一句话串起来",
    subtitle: "全景总结",
    notes: [
      { q: "总结", a: "大模型 = 用海量文本训练的“超级词语接龙机”，靠 Transformer 注意力理解上下文，靠 RLHF 学会当助手，靠 CoT/RAG/工具/Agent 变得能干活——但会一本正经地胡说，所以永远要信任但验证。" },
    ],
  },
];

const TOTAL_NOTES = SECTIONS.reduce((n, s) => n + s.notes.length, 0);

export default function KnowledgeWindow() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set([SECTIONS[0].id]));

  const filtered = useMemo(() => {
    const kw = query.trim().toLowerCase();
    if (!kw) return SECTIONS;
    return SECTIONS.map((s) => ({
      ...s,
      notes: s.notes.filter(
        (n) => n.q.toLowerCase().includes(kw) || n.a.toLowerCase().includes(kw),
      ),
    })).filter((s) => s.notes.length > 0 || s.title.toLowerCase().includes(kw));
  }, [query]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const searching = query.trim().length > 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="打开大模型知识小窗"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10 transition hover:bg-slate-800 hover:shadow-xl"
      >
        <span className="text-base">🧠</span>
        大模型知识
        <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
          {TOTAL_NOTES}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-[min(92vw,26rem)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl ring-1 ring-black/20">
      {/* 标题栏 */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-slate-950 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-base">🧠</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">大模型知识小窗</p>
            <p className="truncate text-[11px] text-slate-400">对话沉淀 · {TOTAL_NOTES} 条要点</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized((m) => !m)}
            aria-label={minimized ? "展开" : "收起"}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            {minimized ? "▢" : "—"}
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label="关闭"
            className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-red-500/20 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* 搜索 */}
          <div className="border-b border-slate-800 bg-slate-900 px-3 py-2.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索知识点，如 幻觉 / RLHF / 注意力"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            />
          </div>

          {/* 内容 */}
          <div className="max-h-[60vh] space-y-2 overflow-y-auto px-3 py-3">
            {filtered.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-slate-500">没找到相关知识点。</p>
            )}
            {filtered.map((section) => {
              const expanded = searching || openIds.has(section.id);
              return (
                <div key={section.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50">
                  <button
                    onClick={() => toggle(section.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-800"
                  >
                    <span className="text-lg">{section.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{section.title}</span>
                      <span className="block truncate text-[11px] text-slate-400">{section.subtitle}</span>
                    </span>
                    <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                      {section.notes.length}
                    </span>
                    <span className={`text-slate-500 transition ${expanded ? "rotate-90" : ""}`}>›</span>
                  </button>
                  {expanded && (
                    <div className="space-y-2 border-t border-slate-700/70 px-3 py-2.5">
                      {section.notes.map((note, i) => (
                        <div key={i} className="rounded-lg bg-slate-900/60 p-3">
                          <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-emerald-300">
                            <span className="text-emerald-400">⭐</span>
                            {note.q}
                          </p>
                          <p className="text-[13px] leading-6 text-slate-300">{note.a}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 页脚 */}
          <div className="border-t border-slate-800 bg-slate-950 px-4 py-2 text-center text-[11px] text-slate-500">
            信任但验证 · Trust but Verify
          </div>
        </>
      )}
    </div>
  );
}

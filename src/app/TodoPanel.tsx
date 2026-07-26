"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, SUPABASE_ENABLED } from "./supabaseClient";

type TodoistDue = { date?: string; datetime?: string; string?: string; is_recurring?: boolean } | null;

type TodoistTask = {
  id: string;
  content: string;
  description?: string;
  priority?: number; // 1..4, 4 = urgent
  due?: TodoistDue;
  project_id?: string;
  is_completed?: boolean;
  url?: string;
};

type TodoistProject = { id: string; name: string; color?: string };

type Filter = { key: string; label: string; query?: string };

const FILTERS: Filter[] = [
  { key: "today", label: "今天", query: "today | overdue" },
  { key: "week", label: "7天", query: "7 days | overdue" },
  { key: "all", label: "全部" },
];

// Todoist REST priority: 4=urgent ... 1=normal. Map to colour + label.
const PRIORITY: Record<number, { color: string; label: string }> = {
  4: { color: "#ef4444", label: "P1" },
  3: { color: "#f59e0b", label: "P2" },
  2: { color: "#3b82f6", label: "P3" },
  1: { color: "#94a3b8", label: "P4" },
};

function dueLabel(due: TodoistDue): { text: string; overdue: boolean } | null {
  if (!due?.date && !due?.datetime) return null;
  const raw = due.datetime || due.date!;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { text: due.string || "", overdue: false };
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const overdue = startOfDue.getTime() < startOfToday.getTime();
  const fmt = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(d);
  return { text: fmt, overdue };
}

export default function TodoPanel() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>(FILTERS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [draftDue, setDraftDue] = useState("");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cloud = SUPABASE_ENABLED;
  const signedIn = Boolean(session);

  const flash = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(() => {
    setMounted(true);
    const supabase = getSupabase();
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadTasks = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !session) return;
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.functions.invoke("todoist", {
      body: { action: "list", filter: filter.query },
    });
    setLoading(false);
    if (err || (data && data.error)) {
      setError((data && data.error) || err?.message || "读取失败");
      return;
    }
    const list = (data?.tasks ?? []) as TodoistTask[];
    const projList = (data?.projects ?? []) as TodoistProject[];
    const pmap: Record<string, string> = {};
    for (const p of projList) pmap[p.id] = p.name;
    setProjects(pmap);
    setTasks(list);
  }, [session, filter]);

  useEffect(() => {
    if (open && signedIn) loadTasks();
  }, [open, signedIn, loadTasks]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const da = a.due?.datetime || a.due?.date || "9999";
      const db = b.due?.datetime || b.due?.date || "9999";
      if (da !== db) return da < db ? -1 : 1;
      return (b.priority ?? 1) - (a.priority ?? 1);
    });
  }, [tasks]);

  async function completeTask(id: string) {
    const prev = tasks;
    setTasks((t) => t.filter((x) => x.id !== id)); // optimistic
    const supabase = getSupabase();
    const { data, error: err } = await supabase!.functions.invoke("todoist", {
      body: { action: "complete", id },
    });
    if (err || (data && data.error) || (data && data.ok === false)) {
      setTasks(prev); // rollback
      flash("完成失败");
      return;
    }
    flash("已完成 ✓");
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setAdding(true);
    const supabase = getSupabase();
    const { data, error: err } = await supabase!.functions.invoke("todoist", {
      body: { action: "add", content, due: draftDue.trim() || undefined },
    });
    setAdding(false);
    if (err || (data && data.error) || (data && data.ok === false)) {
      flash("添加失败");
      return;
    }
    setDraft("");
    setDraftDue("");
    flash("已添加");
    loadTasks();
  }

  async function handleGithubLogin() {
    const supabase = getSupabase();
    if (!supabase) return;
    setAuthBusy(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.href.split("#")[0] },
    });
    if (err) setAuthBusy(false);
  }

  if (!cloud) return null;

  return (
    <>
      {/* Launcher (bottom-left, opposite the knowledge base) */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="打开待办"
        className={`fixed bottom-5 left-5 z-50 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--launcher)] px-4 py-3 text-sm font-semibold text-[var(--heading)] shadow-[0_18px_40px_-18px_rgba(56,189,248,0.6)] transition hover:-translate-y-0.5 hover:border-sky-400/40 ${
          open ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-400 text-[#08121a]">
          <CheckIcon />
        </span>
        待办
        {mounted && signedIn && tasks.length > 0 ? (
          <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-xs text-[var(--muted)]">
            {tasks.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      ) : null}

      {open ? (
        <section
          role="dialog"
          aria-label="待办"
          className="fixed inset-x-3 bottom-3 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl sm:inset-auto sm:bottom-5 sm:left-5 sm:top-auto sm:h-[78vh] sm:max-h-[720px] sm:w-[400px]"
        >
          {/* Title bar */}
          <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-400 text-[#08121a]">
                <CheckIcon />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-[var(--heading)]">待办 · Todoist</p>
                <p className="text-[11px] text-[var(--muted)]">
                  {!mounted ? "加载中…" : !signedIn ? "请先登录" : `${tasks.length} 项${loading ? " · 同步中" : ""}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {signedIn ? (
                <IconButton title="刷新" onClick={loadTasks}>
                  <RefreshIcon />
                </IconButton>
              ) : null}
              <IconButton title="关闭" onClick={() => setOpen(false)}>
                <CloseIcon />
              </IconButton>
            </div>
          </header>

          {cloud && authReady && !signedIn ? (
            <div className="flex flex-1 flex-col justify-center px-6 py-8">
              <p className="text-center text-sm font-semibold text-[var(--heading)]">登录后同步 Todoist</p>
              <p className="mt-1 text-center text-xs text-[var(--dim)]">用同一个 GitHub 账号登录即可</p>
              <button
                onClick={handleGithubLogin}
                disabled={authBusy}
                className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[#0d1117] transition hover:bg-slate-100 disabled:opacity-60"
              >
                <GithubIcon />
                {authBusy ? "跳转 GitHub 中…" : "用 GitHub 登录"}
              </button>
            </div>
          ) : !authReady ? (
            <div className="grid flex-1 place-items-center text-sm text-[var(--dim)]">连接中…</div>
          ) : (
            <>
              {/* Quick add */}
              <form onSubmit={addTask} className="space-y-2 border-b border-[var(--border)] px-4 py-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="添加任务…"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--dim)] outline-none focus:border-sky-400/40"
                />
                <div className="flex items-center gap-2">
                  <input
                    value={draftDue}
                    onChange={(e) => setDraftDue(e.target.value)}
                    placeholder="何时（今天/明天/下周一，可空）"
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--dim)] outline-none focus:border-sky-400/40"
                  />
                  <button
                    type="submit"
                    disabled={adding || !draft.trim()}
                    className="shrink-0 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-400 px-3 py-2 text-sm font-semibold text-[#08121a] transition hover:opacity-90 disabled:opacity-50"
                  >
                    + 添加
                  </button>
                </div>
              </form>

              {/* Filters */}
              <div className="flex gap-1.5 border-b border-[var(--border)] px-4 py-2.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      filter.key === f.key
                        ? "bg-sky-400 text-[#08121a]"
                        : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Task list */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {error ? (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
                    {error}
                  </div>
                ) : loading && tasks.length === 0 ? (
                  <div className="space-y-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--surface)]" />
                    ))}
                  </div>
                ) : sorted.length === 0 ? (
                  <div className="grid h-full place-items-center px-6 text-center">
                    <div>
                      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-sky-400">
                        <CheckIcon />
                      </div>
                      <p className="text-sm font-medium text-[var(--text)]">没有任务 🎉</p>
                      <p className="mt-1 text-xs text-[var(--dim)]">这个筛选下没有待办</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {sorted.map((task) => {
                      const pr = PRIORITY[task.priority ?? 1] ?? PRIORITY[1];
                      const due = dueLabel(task.due ?? null);
                      return (
                        <div
                          key={task.id}
                          className="group flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--border-strong)]"
                        >
                          <button
                            onClick={() => completeTask(task.id)}
                            aria-label="完成"
                            className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition hover:bg-sky-400/20"
                            style={{ borderColor: pr.color }}
                          >
                            <span className="opacity-0 transition group-hover:opacity-100" style={{ color: pr.color }}>
                              <TinyCheck />
                            </span>
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug text-[var(--text)]">{task.content}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                              {due ? (
                                <span className={due.overdue ? "font-semibold text-rose-400" : "text-[var(--muted)]"}>
                                  {task.due?.is_recurring ? "🔁 " : ""}
                                  {due.text}
                                </span>
                              ) : null}
                              {task.project_id && projects[task.project_id] ? (
                                <span className="text-[var(--dim)]">#{projects[task.project_id]}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {toast ? (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-sky-400 px-3.5 py-1.5 text-xs font-semibold text-[#08121a] shadow-lg">
              {toast}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--heading)]"
    >
      {children}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function TinyCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
    </svg>
  );
}
function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.6 9.6 0 0 1 12 6.8c.85 0 1.71.11 2.51.33 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z" />
    </svg>
  );
}

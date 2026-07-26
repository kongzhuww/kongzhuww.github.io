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
  section_id?: string | null;
  labels?: string[];
  is_completed?: boolean;
};

type TodoistProject = { id: string; name: string; color?: string; is_inbox_project?: boolean };
type TodoistSection = { id: string; name: string; order?: number; project_id?: string };

type Filter = { key: string; label: string; query?: string };

const FILTERS: Filter[] = [
  { key: "today", label: "今天", query: "today | overdue" },
  { key: "week", label: "7天", query: "7 days | overdue" },
  { key: "all", label: "全部" },
];

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
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const overdue = startDue.getTime() < startToday.getTime();
  const text = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(d);
  return { text, overdue };
}

export default function TodoPanel() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>(FILTERS[0]);

  // board state
  const [projects, setProjects] = useState<TodoistProject[]>([]);
  const [boardProjectId, setBoardProjectId] = useState<string | null>(null);
  const [sections, setSections] = useState<TodoistSection[]>([]);
  const [boardTasks, setBoardTasks] = useState<TodoistTask[]>([]);

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

  const invoke = useCallback(
    async (payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
      const supabase = getSupabase();
      if (!supabase) return { error: "no client" };
      const { data, error: err } = await supabase.functions.invoke("todoist", { body: payload });
      if (err && !data) return { error: err.message };
      return (data ?? {}) as Record<string, unknown>;
    },
    [],
  );

  const loadList = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    const data = await invoke({ action: "list", filter: filter.query });
    setLoading(false);
    if (data?.error) return setError(String(data.error));
    const pmap: Record<string, string> = {};
    for (const p of (data.projects ?? []) as TodoistProject[]) pmap[p.id] = p.name;
    setProjectsMap(pmap);
    setTasks((data.tasks ?? []) as TodoistTask[]);
  }, [session, filter, invoke]);

  const loadBoard = useCallback(
    async (projectId?: string | null) => {
      if (!session) return;
      setLoading(true);
      setError("");
      const data = await invoke({ action: "board", project_id: projectId ?? undefined });
      setLoading(false);
      if (data?.error) return setError(String(data.error));
      setProjects((data.projects ?? []) as TodoistProject[]);
      setSections((data.sections ?? []) as TodoistSection[]);
      setBoardTasks((data.tasks ?? []) as TodoistTask[]);
      setBoardProjectId((data.projectId as string) ?? null);
    },
    [session, invoke],
  );

  useEffect(() => {
    if (!open || !signedIn) return;
    if (view === "list") loadList();
    else loadBoard(boardProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signedIn, view, filter]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setFullscreen((fs) => {
        if (fs) return false;
        setOpen(false);
        return fs;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sortedList = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const da = a.due?.datetime || a.due?.date || "9999";
      const db = b.due?.datetime || b.due?.date || "9999";
      if (da !== db) return da < db ? -1 : 1;
      return (b.priority ?? 1) - (a.priority ?? 1);
    });
  }, [tasks]);

  const columns = useMemo(() => {
    const secs = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const bySection: Record<string, TodoistTask[]> = { none: [] };
    for (const s of secs) bySection[s.id] = [];
    for (const t of boardTasks) {
      const key = t.section_id && bySection[t.section_id] ? t.section_id : "none";
      bySection[key].push(t);
    }
    const cols: { id: string; name: string; tasks: TodoistTask[] }[] = [
      { id: "none", name: "无分区", tasks: bySection.none },
      ...secs.map((s) => ({ id: s.id, name: s.name, tasks: bySection[s.id] ?? [] })),
    ];
    return cols.filter((c) => c.id !== "none" || c.tasks.length > 0);
  }, [sections, boardTasks]);

  function removeLocal(id: string) {
    setTasks((t) => t.filter((x) => x.id !== id));
    setBoardTasks((t) => t.filter((x) => x.id !== id));
  }

  async function completeTask(id: string) {
    const prevA = tasks, prevB = boardTasks;
    removeLocal(id);
    const data = await invoke({ action: "complete", id });
    if (data?.error || data?.ok === false) {
      setTasks(prevA);
      setBoardTasks(prevB);
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
    const payload: Record<string, unknown> = { action: "add", content, due: draftDue.trim() || undefined };
    if (view === "board" && boardProjectId) payload.project_id = boardProjectId;
    const data = await invoke(payload);
    setAdding(false);
    if (data?.error || data?.ok === false) return flash("添加失败");
    setDraft("");
    setDraftDue("");
    flash("已添加");
    if (view === "list") loadList();
    else loadBoard(boardProjectId);
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

  const total = view === "board" ? boardTasks.length : tasks.length;

  return (
    <>
      {/* Launcher (bottom-left) */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="打开待办"
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--heading)] transition hover:-translate-y-0.5 hover:border-sky-400/40"
      >
        <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-sky-400 to-indigo-400 text-[#08121a]">
          <CheckIcon />
        </span>
        待办
        {mounted && signedIn && total > 0 ? (
          <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-xs text-[var(--muted)]">{total}</span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      ) : null}

      {open ? (
        <section
          role="dialog"
          aria-label="待办"
          className={
            fullscreen
              ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-[var(--panel)]"
              : "fixed inset-x-3 bottom-3 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl sm:inset-auto sm:bottom-5 sm:left-5 sm:top-auto sm:h-[80vh] sm:max-h-[760px] sm:w-[440px]"
          }
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
                  {!mounted ? "加载中…" : !signedIn ? "请先登录" : `${total} 项${loading ? " · 同步中" : ""}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {signedIn ? (
                <>
                  <IconButton title="刷新" onClick={() => (view === "list" ? loadList() : loadBoard(boardProjectId))}>
                    <RefreshIcon />
                  </IconButton>
                  <IconButton title={fullscreen ? "收起" : "展开整页"} onClick={() => setFullscreen((v) => !v)}>
                    {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
                  </IconButton>
                </>
              ) : null}
              <IconButton
                title="关闭"
                onClick={() => {
                  setOpen(false);
                  setFullscreen(false);
                }}
              >
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
              <form onSubmit={addTask} className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="添加任务…"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--dim)] outline-none focus:border-sky-400/40"
                />
                <input
                  value={draftDue}
                  onChange={(e) => setDraftDue(e.target.value)}
                  placeholder="何时"
                  className="w-24 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--text)] placeholder:text-[var(--dim)] outline-none focus:border-sky-400/40"
                />
                <button
                  type="submit"
                  disabled={adding || !draft.trim()}
                  className="shrink-0 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-400 px-3 py-2 text-sm font-semibold text-[#08121a] transition hover:opacity-90 disabled:opacity-50"
                >
                  +
                </button>
              </form>

              {/* View switch + context */}
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
                <div className="flex rounded-lg border border-[var(--border)] p-0.5">
                  <ViewTab active={view === "list"} onClick={() => setView("list")}>
                    列表
                  </ViewTab>
                  <ViewTab active={view === "board"} onClick={() => setView("board")}>
                    看板
                  </ViewTab>
                </div>

                {view === "list" ? (
                  <div className="flex gap-1.5">
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
                ) : (
                  <select
                    value={boardProjectId ?? ""}
                    onChange={(e) => loadBoard(e.target.value)}
                    className="max-w-[55%] truncate rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] outline-none focus:border-sky-400/40"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.is_inbox_project ? "收件箱" : p.name}
                      </option>
                    ))}
                  </select>
                )}
                {view === "board" && !fullscreen ? (
                  <span className="ml-auto text-[10px] text-[var(--dim)]">建议展开 ⤢</span>
                ) : null}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-hidden">
                {error ? (
                  <div className="m-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
                ) : view === "list" ? (
                  <ListView
                    tasks={sortedList}
                    loading={loading}
                    projectsMap={projectsMap}
                    onComplete={completeTask}
                  />
                ) : (
                  <BoardView columns={columns} loading={loading} onComplete={completeTask} />
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

function ListView({
  tasks,
  loading,
  projectsMap,
  onComplete,
}: {
  tasks: TodoistTask[];
  loading: boolean;
  projectsMap: Record<string, string>;
  onComplete: (id: string) => void;
}) {
  if (loading && tasks.length === 0) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--surface)]" />
        ))}
      </div>
    );
  }
  if (tasks.length === 0) return <EmptyState />;
  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      <div className="mx-auto max-w-3xl space-y-1.5">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} projectName={t.project_id ? projectsMap[t.project_id] : undefined} onComplete={onComplete} />
        ))}
      </div>
    </div>
  );
}

function BoardView({
  columns,
  loading,
  onComplete,
}: {
  columns: { id: string; name: string; tasks: TodoistTask[] }[];
  loading: boolean;
  onComplete: (id: string) => void;
}) {
  if (loading && columns.every((c) => c.tasks.length === 0)) {
    return (
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 w-72 shrink-0 animate-pulse rounded-2xl bg-[var(--surface)]" />
        ))}
      </div>
    );
  }
  if (columns.length === 0) return <EmptyState />;
  return (
    <div className="flex h-full gap-3 overflow-x-auto overflow-y-hidden p-4">
      {columns.map((col) => (
        <div key={col.id} className="flex h-full w-72 shrink-0 flex-col">
          <div className="mb-2 flex items-center gap-2 px-1">
            <h3 className="text-sm font-semibold text-[var(--heading)]">{col.name}</h3>
            <span className="rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
              {col.tasks.length}
            </span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {col.tasks.map((t) => (
              <TaskCard key={t.id} task={t} onComplete={onComplete} card />
            ))}
            {col.tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--dim)]">空</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({
  task,
  projectName,
  onComplete,
  card,
}: {
  task: TodoistTask;
  projectName?: string;
  onComplete: (id: string) => void;
  card?: boolean;
}) {
  const pr = PRIORITY[task.priority ?? 1] ?? PRIORITY[1];
  const due = dueLabel(task.due ?? null);
  return (
    <div
      className={`group flex items-start gap-3 border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--border-strong)] ${
        card ? "rounded-2xl" : "rounded-xl"
      }`}
    >
      <button
        onClick={() => onComplete(task.id)}
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
        {task.description ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-[var(--dim)]">{task.description}</p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
          {due ? (
            <span className={due.overdue ? "font-semibold text-rose-400" : "text-[var(--muted)]"}>
              {task.due?.is_recurring ? "🔁 " : "📅 "}
              {due.text}
            </span>
          ) : null}
          {projectName ? <span className="text-[var(--dim)]">#{projectName}</span> : null}
          {(task.labels ?? []).map((l) => (
            <span key={l} className="rounded-full bg-sky-400/10 px-1.5 py-0.5 text-[10px] text-sky-300">
              @{l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-sky-400">
          <CheckIcon />
        </div>
        <p className="text-sm font-medium text-[var(--text)]">没有任务 🎉</p>
        <p className="mt-1 text-xs text-[var(--dim)]">这里是空的</p>
      </div>
    </div>
  );
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
        active ? "bg-sky-400 text-[#08121a]" : "text-[var(--muted)] hover:text-[var(--heading)]"
      }`}
    >
      {children}
    </button>
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
function MaximizeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}
function MinimizeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
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

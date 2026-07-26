"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, SUPABASE_ENABLED } from "./supabaseClient";

type Due = { date?: string; datetime?: string; string?: string } | null;
type Task = { id: string; content: string; due?: Due; priority?: number };

// Today's Todoist tasks on the dashboard: check one to complete it (syncs back
// to Todoist via the `todoist` edge function, then it fades out).
export default function DashboardTodos() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [checking, setChecking] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!SUPABASE_ENABLED) {
      setAuthReady(true);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !session) return;
    setState("loading");
    try {
      const { data, error } = await supabase.functions.invoke("todoist", {
        body: { action: "list", filter: "today | overdue" },
      });
      if (error) throw error;
      setTasks((data?.tasks ?? []) as Task[]);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [session]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  function complete(id: string) {
    setChecking((c) => new Set(c).add(id));
    setTimeout(async () => {
      setTasks((t) => t.filter((x) => x.id !== id));
      setChecking((c) => {
        const n = new Set(c);
        n.delete(id);
        return n;
      });
      const supabase = getSupabase();
      if (!supabase) return;
      const { error } = await supabase.functions.invoke("todoist", { body: { action: "complete", id } });
      if (error) load(); // failed → refresh to bring it back
    }, 320);
  }

  async function signIn() {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.href.split("#")[0] },
    });
  }

  if (!SUPABASE_ENABLED) return null;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-400 text-sm text-[#08121a]">✓</span>
          <p className="text-sm font-semibold text-[var(--heading)]">今日待办</p>
          {session && tasks.length > 0 ? (
            <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--muted)]">{tasks.length}</span>
          ) : null}
        </div>
        {session ? (
          <button onClick={load} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--heading)]">
            ↻
          </button>
        ) : null}
      </div>

      <div className="max-h-[150px] overflow-y-auto pr-1">
      {!authReady || (session && state === "loading") ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-xl bg-[var(--surface-hover)]" />
          ))}
        </div>
      ) : !session ? (
        <div className="flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
          <span>登录后在这里查看并勾选今天的待办。</span>
          <button onClick={signIn} className="shrink-0 rounded-full bg-[var(--heading)] px-3.5 py-1.5 text-xs font-semibold text-[var(--panel)] transition hover:bg-sky-300 hover:text-[#08121a]">
            登录
          </button>
        </div>
      ) : state === "error" ? (
        <p className="text-sm text-[var(--muted)]">待办加载失败，点 ↻ 重试。</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">今天没有待办，休息一下 🎉</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) => {
            const done = checking.has(t.id);
            return (
              <li key={t.id}>
                <button
                  onClick={() => !done && complete(t.id)}
                  className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--surface)]"
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${
                      done ? "border-emerald-400 bg-emerald-400 text-[#08121a]" : "border-[var(--border-strong)] text-transparent group-hover:border-sky-400"
                    }`}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${done ? "text-[var(--dim)] line-through" : "text-[var(--text)]"}`}>{t.content}</span>
                  {t.due?.string ? <span className="shrink-0 text-[11px] text-[var(--dim)]">{t.due.string}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, SUPABASE_ENABLED, type KnowledgeRow } from "./supabaseClient";

type KnowledgeEntry = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

const CACHE_KEY = "lw-knowledge-cache:v1";

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowToEntry(row: KnowledgeRow): KnowledgeEntry {
  return {
    id: row.id,
    title: row.title ?? "",
    content: row.content ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

function loadCache(): KnowledgeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.title === "string") : [];
  } catch {
    return [];
  }
}

function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

function formatWhen(ts: number) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

export default function KnowledgeBase() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showTags, setShowTags] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [syncing, setSyncing] = useState(false);

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [toast, setToast] = useState("");

  // login
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }, []);

  // mount + hydrate cache + wire auth
  useEffect(() => {
    setMounted(true);
    setEntries(loadCache());

    const supabase = getSupabase();
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // keep a local cache mirror so content shows instantly / offline
  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    } catch {
      /* ignore */
    }
  }, [entries, mounted]);

  const loadFromCloud = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !session) return;
    setSyncing(true);
    const { data, error } = await supabase
      .from("knowledge")
      .select("*")
      .order("updated_at", { ascending: false });
    setSyncing(false);
    if (error) {
      flash("云端读取失败");
      return;
    }
    setEntries((data as KnowledgeRow[]).map(rowToEntry));
  }, [session, flash]);

  // load cloud data whenever we get a session
  useEffect(() => {
    if (session) loadFromCloud();
  }, [session, loadFromCloud]);

  // close on Escape
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

  const signedIn = Boolean(session);
  const cloud = SUPABASE_ENABLED;

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => (activeTag ? e.tags.includes(activeTag) : true))
      .filter((e) => {
        if (!q) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [entries, query, activeTag]);

  function onListScroll() {
    const el = listRef.current;
    if (!el) return;
    const y = el.scrollTop;
    if (y < 48) setShowTags(true);
    else if (y > lastScrollY.current + 6) setShowTags(false);
    else if (y < lastScrollY.current - 6) setShowTags(true);
    lastScrollY.current = y;
  }

  function resetDraft() {
    setEditingId(null);
    setDraftTitle("");
    setDraftContent("");
    setDraftTags("");
  }
  function openComposer() {
    resetDraft();
    setComposerOpen(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  }
  function startEdit(entry: KnowledgeEntry) {
    setEditingId(entry.id);
    setDraftTitle(entry.title);
    setDraftContent(entry.content);
    setDraftTags(entry.tags.join(" "));
    setComposerOpen(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  }

  async function saveDraft() {
    const title = draftTitle.trim();
    const content = draftContent.trim();
    if (!title && !content) {
      flash("标题或内容至少填一个");
      return;
    }
    const tags = parseTags(draftTags);
    const supabase = getSupabase();
    const now = Date.now();

    if (editingId) {
      // optimistic
      setEntries((prev) =>
        prev.map((e) => (e.id === editingId ? { ...e, title: title || "无标题", content, tags, updatedAt: now } : e)),
      );
      if (supabase && signedIn) {
        const { error } = await supabase
          .from("knowledge")
          .update({ title: title || "无标题", content, tags, updated_at: new Date(now).toISOString() })
          .eq("id", editingId);
        flash(error ? "云端更新失败" : "已更新");
      } else {
        flash("已更新（本地）");
      }
    } else {
      if (supabase && signedIn) {
        const { data, error } = await supabase
          .from("knowledge")
          .insert({ title: title || "无标题", content, tags })
          .select()
          .single();
        if (error || !data) {
          if (error) console.error("知识库添加失败:", error);
          flash(error ? `添加失败: ${error.message}` : "添加失败");
          return;
        }
        setEntries((prev) => [rowToEntry(data as KnowledgeRow), ...prev]);
        flash("已添加");
      } else {
        const entry: KnowledgeEntry = { id: makeId(), title: title || "无标题", content, tags, createdAt: now, updatedAt: now };
        setEntries((prev) => [entry, ...prev]);
        flash("已添加（本地）");
      }
    }
    resetDraft();
    setComposerOpen(false);
  }

  async function removeEntry(id: string) {
    const prev = entries;
    setEntries((cur) => cur.filter((e) => e.id !== id));
    if (editingId === id) {
      resetDraft();
      setComposerOpen(false);
    }
    const supabase = getSupabase();
    if (supabase && signedIn) {
      const { error } = await supabase.from("knowledge").delete().eq("id", id);
      if (error) {
        setEntries(prev); // rollback
        flash("云端删除失败");
        return;
      }
    }
    flash("已删除");
  }

  async function handleGithubLogin() {
    const supabase = getSupabase();
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.href.split("#")[0] },
    });
    // on success the browser redirects to GitHub, so code below only runs on error
    if (error) {
      setAuthBusy(false);
      setAuthError(error.message || "跳转 GitHub 登录失败");
    }
  }

  async function handleLogout() {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setEntries(loadCache());
    flash("已登出");
  }

  function exportJson() {
    try {
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `knowledge-base-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flash("已导出 JSON");
    } catch {
      flash("导出失败");
    }
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("bad");
        const incoming = parsed
          .filter((e) => e && (typeof e.title === "string" || typeof e.content === "string"))
          .map((e) => ({
            title: String(e.title ?? "无标题"),
            content: String(e.content ?? ""),
            tags: Array.isArray(e.tags) ? e.tags.map(String) : [],
          }));
        const supabase = getSupabase();
        if (supabase && signedIn && incoming.length) {
          const { data, error } = await supabase.from("knowledge").insert(incoming).select();
          if (error) {
            console.error("知识库导入失败:", error);
            flash(`导入失败: ${error.message}`);
            return;
          }
          setEntries((prev) => [...(data as KnowledgeRow[]).map(rowToEntry), ...prev]);
        } else {
          const now = Date.now();
          setEntries((prev) => [
            ...incoming.map((e) => ({ ...e, id: makeId(), createdAt: now, updatedAt: now })),
            ...prev,
          ]);
        }
        flash(`已导入 ${incoming.length} 条`);
      } catch {
        flash("导入失败：文件格式不对");
      }
    };
    reader.readAsText(file);
  }

  const statusLine = !cloud
    ? `${entries.length} 条 · 本地保存`
    : signedIn
      ? `${entries.length} 条 · 云端同步${syncing ? " · 同步中" : ""}`
      : "请先登录";

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="打开知识库"
        className={`fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1420] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(16,185,129,0.7)] transition hover:-translate-y-0.5 hover:border-emerald-400/40 ${
          open ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-sky-400 text-[#08121a]">
          <BookIcon />
        </span>
        知识库
        {mounted && entries.length > 0 ? (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{entries.length}</span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      ) : null}

      {open ? (
        <section
          role="dialog"
          aria-label="知识库"
          className={
            fullscreen
              ? "fixed inset-0 z-50 flex flex-col overflow-hidden border-0 bg-[#0a121c]"
              : "fixed inset-x-3 bottom-3 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a121c] shadow-2xl sm:inset-auto sm:bottom-5 sm:right-5 sm:top-auto sm:h-[78vh] sm:max-h-[720px] sm:w-[420px]"
          }
        >
          {/* Title bar */}
          <header className="flex items-center justify-between gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-400 text-[#08121a]">
                <BookIcon />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">我的知识库</p>
                <p className="text-[11px] text-slate-400">{mounted ? statusLine : "加载中…"}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {signedIn || !cloud ? (
                <>
                  <IconButton title="导出 JSON" onClick={exportJson}>
                    <DownloadIcon />
                  </IconButton>
                  <IconButton title="导入 JSON" onClick={() => fileInputRef.current?.click()}>
                    <UploadIcon />
                  </IconButton>
                </>
              ) : null}
              {signedIn ? (
                <IconButton title="登出" onClick={handleLogout}>
                  <LogoutIcon />
                </IconButton>
              ) : null}
              <IconButton
                title={fullscreen ? "收起为小窗" : "展开为整页"}
                onClick={() => setFullscreen((v) => !v)}
              >
                {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
              </IconButton>
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
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = "";
              }}
            />
          </header>

          {/* Auth gate */}
          {cloud && authReady && !signedIn ? (
            <div className="flex flex-1 flex-col justify-center px-6 py-8">
              <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-emerald-300">
                <LockIcon />
              </div>
              <p className="text-center text-sm font-semibold text-white">登录后使用云端知识库</p>
              <p className="mt-1 text-center text-xs text-slate-500">数据私密保存，仅你可见，多设备同步</p>
              <button
                onClick={handleGithubLogin}
                disabled={authBusy}
                className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#0d1117] transition hover:bg-slate-100 disabled:opacity-60"
              >
                <GithubIcon />
                {authBusy ? "跳转 GitHub 中…" : "用 GitHub 登录"}
              </button>
              {authError ? <p className="mt-3 text-center text-xs text-rose-400">{authError}</p> : null}
              <p className="mt-4 text-center text-[11px] leading-5 text-slate-600">
                点击后会跳转到 GitHub 授权，授权后自动返回并登录。
              </p>
            </div>
          ) : cloud && !authReady ? (
            <div className="grid flex-1 place-items-center text-sm text-slate-500">连接中…</div>
          ) : (
            <>
              {/* Search + add */}
              <div className="border-b border-white/8 px-4 py-3">
                <div className={`flex items-center gap-2 ${fullscreen ? "mx-auto w-full max-w-5xl" : ""}`}>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <SearchIcon />
                    </span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="搜索知识…"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-emerald-400/40 focus:bg-white/[0.06]"
                    />
                  </div>
                  {allTags.length > 0 ? (
                    <button
                      onClick={() => setShowTags((v) => !v)}
                      title={showTags ? "收起标签" : "展开标签"}
                      className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-white/25"
                    >
                      标签 {showTags ? "▴" : "▾"}
                    </button>
                  ) : null}
                  <button
                    onClick={openComposer}
                    className="shrink-0 rounded-xl bg-gradient-to-br from-emerald-400 to-sky-400 px-3 py-2 text-sm font-semibold text-[#08121a] transition hover:opacity-90"
                  >
                    + 添加
                  </button>
                </div>
                {allTags.length > 0 ? (
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      showTags ? "mt-2.5 max-h-36 opacity-100" : "max-h-0 opacity-0"
                    } ${fullscreen ? "mx-auto w-full max-w-5xl" : ""}`}
                  >
                    <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-1">
                      <TagChip active={activeTag === null} onClick={() => setActiveTag(null)}>
                        全部
                      </TagChip>
                      {allTags.map((t) => (
                        <TagChip key={t} active={activeTag === t} onClick={() => setActiveTag(activeTag === t ? null : t)}>
                          #{t}
                        </TagChip>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Composer */}
              {composerOpen ? (
                <div className="space-y-2.5 border-b border-white/8 bg-white/[0.02] px-4 py-3">
                  <input
                    ref={titleRef}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="标题"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
                  />
                  <textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    placeholder="内容 / 笔记…"
                    rows={4}
                    className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm leading-6 text-slate-200 placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
                  />
                  <input
                    value={draftTags}
                    onChange={(e) => setDraftTags(e.target.value)}
                    placeholder="标签（用空格或逗号分隔）"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
                  />
                  <div className="flex items-center justify-end gap-2 pt-0.5">
                    <button
                      onClick={() => {
                        resetDraft();
                        setComposerOpen(false);
                      }}
                      className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition hover:text-slate-200"
                    >
                      取消
                    </button>
                    <button
                      onClick={saveDraft}
                      className="rounded-lg bg-emerald-400/90 px-4 py-1.5 text-sm font-semibold text-[#08121a] transition hover:bg-emerald-300"
                    >
                      {editingId ? "保存" : "添加"}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* List */}
              <div
                ref={listRef}
                onScroll={onListScroll}
                className={`flex-1 overflow-y-auto py-3 ${fullscreen ? "px-4 sm:px-6" : "px-4"}`}
              >
                {!mounted ? null : filtered.length === 0 ? (
                  <EmptyState hasEntries={entries.length > 0} onAdd={openComposer} />
                ) : (
                  <div
                    className={
                      fullscreen
                        ? "mx-auto w-full max-w-6xl gap-4 [column-fill:balance] [&>*]:mb-4 [&>*]:break-inside-avoid columns-1 md:columns-2 xl:columns-3"
                        : "space-y-2.5"
                    }
                  >
                    {filtered.map((entry) => (
                      <article
                        key={entry.id}
                        className={`group rounded-xl border border-white/8 bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.05] ${
                          fullscreen ? "p-5" : "p-3.5 card-cv"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className={`font-semibold leading-snug text-white ${fullscreen ? "text-base" : "text-sm"}`}
                          >
                            {entry.title}
                          </h3>
                          <div
                            className={`flex shrink-0 items-center gap-1 transition ${
                              fullscreen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            <IconButton title="编辑" small onClick={() => startEdit(entry)}>
                              <EditIcon />
                            </IconButton>
                            <IconButton title="删除" small onClick={() => removeEntry(entry.id)}>
                              <TrashIcon />
                            </IconButton>
                          </div>
                        </div>
                        {entry.content ? (
                          <p
                            className={`mt-2 whitespace-pre-wrap text-slate-300 ${
                              fullscreen ? "text-sm leading-7" : "text-[13px] leading-6"
                            }`}
                          >
                            {entry.content}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {entry.tags.map((t) => (
                            <button
                              key={t}
                              onClick={() => setActiveTag(t)}
                              className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-400/20"
                            >
                              #{t}
                            </button>
                          ))}
                          <span className="ml-auto text-[11px] text-slate-500">{formatWhen(entry.updatedAt)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {toast ? (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-emerald-400 px-3.5 py-1.5 text-xs font-semibold text-[#08121a] shadow-lg">
              {toast}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function EmptyState({ hasEntries, onAdd }: { hasEntries: boolean; onAdd: () => void }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-emerald-300">
          <BookIcon />
        </div>
        <p className="text-sm font-medium text-slate-300">{hasEntries ? "没有匹配的知识" : "还没有知识条目"}</p>
        <p className="mt-1 text-xs text-slate-500">{hasEntries ? "换个关键词或标签试试" : "点下面按钮，添加你的第一条知识"}</p>
        {!hasEntries ? (
          <button
            onClick={onAdd}
            className="mt-4 rounded-xl bg-gradient-to-br from-emerald-400 to-sky-400 px-4 py-2 text-sm font-semibold text-[#08121a] transition hover:opacity-90"
          >
            + 添加知识
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TagChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active ? "bg-emerald-400 text-[#08121a]" : "border border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25"
      }`}
    >
      {children}
    </button>
  );
}

function IconButton({
  title,
  onClick,
  children,
  small,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`grid place-items-center rounded-lg border border-white/8 bg-white/[0.03] text-slate-300 transition hover:border-white/25 hover:text-white ${
        small ? "h-7 w-7" : "h-8 w-8"
      }`}
    >
      {children}
    </button>
  );
}

/* ---- inline icons ---- */
function BookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
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
function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
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
function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

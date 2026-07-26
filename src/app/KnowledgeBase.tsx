"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type KnowledgeEntry = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "lw-knowledge-base:v1";

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadEntries(): KnowledgeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.title === "string");
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
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [toast, setToast] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    setEntries(loadEntries());
    setMounted(true);
  }, []);

  // persist whenever entries change (after initial hydration)
  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* storage may be full or blocked; ignore */
    }
  }, [entries, mounted]);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

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

  function saveDraft() {
    const title = draftTitle.trim();
    const content = draftContent.trim();
    if (!title && !content) {
      flash("标题或内容至少填一个");
      return;
    }
    const tags = parseTags(draftTags);
    const now = Date.now();
    if (editingId) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingId ? { ...e, title: title || "无标题", content, tags, updatedAt: now } : e,
        ),
      );
      flash("已更新");
    } else {
      const entry: KnowledgeEntry = {
        id: makeId(),
        title: title || "无标题",
        content,
        tags,
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => [entry, ...prev]);
      flash("已添加");
    }
    resetDraft();
    setComposerOpen(false);
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) {
      resetDraft();
      setComposerOpen(false);
    }
    flash("已删除");
  }

  function exportJson() {
    try {
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `knowledge-base-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flash("已导出 JSON");
    } catch {
      flash("导出失败");
    }
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("bad");
        const incoming: KnowledgeEntry[] = parsed
          .filter((e) => e && (typeof e.title === "string" || typeof e.content === "string"))
          .map((e) => ({
            id: typeof e.id === "string" ? e.id : makeId(),
            title: String(e.title ?? "无标题"),
            content: String(e.content ?? ""),
            tags: Array.isArray(e.tags) ? e.tags.map(String) : [],
            createdAt: Number(e.createdAt) || Date.now(),
            updatedAt: Number(e.updatedAt) || Date.now(),
          }));
        setEntries((prev) => {
          const byId = new Map(prev.map((e) => [e.id, e]));
          for (const e of incoming) byId.set(e.id, e);
          return Array.from(byId.values());
        });
        flash(`已导入 ${incoming.length} 条`);
      } catch {
        flash("导入失败：文件格式不对");
      }
    };
    reader.readAsText(file);
  }

  return (
    <>
      {/* Launcher button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="打开知识库"
        className={`fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1420]/90 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(16,185,129,0.7)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-400/40 ${
          open ? "opacity-0 pointer-events-none" : "opacity-100"
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

      {/* Backdrop (mobile) */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Window */}
      {open ? (
        <section
          role="dialog"
          aria-label="知识库"
          className="fixed inset-x-3 bottom-3 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a121c]/95 shadow-2xl backdrop-blur-2xl sm:inset-auto sm:bottom-5 sm:right-5 sm:top-auto sm:h-[78vh] sm:w-[420px] sm:max-h-[720px]"
        >
          {/* Title bar */}
          <header className="flex items-center justify-between gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-400 text-[#08121a]">
                <BookIcon />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">我的知识库</p>
                <p className="text-[11px] text-slate-400">
                  {mounted ? `${entries.length} 条 · 本地保存` : "加载中…"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <IconButton title="导出 JSON" onClick={exportJson}>
                <DownloadIcon />
              </IconButton>
              <IconButton title="导入 JSON" onClick={() => fileInputRef.current?.click()}>
                <UploadIcon />
              </IconButton>
              <IconButton title="关闭" onClick={() => setOpen(false)}>
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

          {/* Search + add */}
          <div className="border-b border-white/8 px-4 py-3">
            <div className="flex items-center gap-2">
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
              <button
                onClick={openComposer}
                className="shrink-0 rounded-xl bg-gradient-to-br from-emerald-400 to-sky-400 px-3 py-2 text-sm font-semibold text-[#08121a] transition hover:opacity-90"
              >
                + 添加
              </button>
            </div>

            {allTags.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <TagChip active={activeTag === null} onClick={() => setActiveTag(null)}>
                  全部
                </TagChip>
                {allTags.map((t) => (
                  <TagChip key={t} active={activeTag === t} onClick={() => setActiveTag(activeTag === t ? null : t)}>
                    #{t}
                  </TagChip>
                ))}
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
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {!mounted ? null : filtered.length === 0 ? (
              <EmptyState hasEntries={entries.length > 0} onAdd={openComposer} />
            ) : (
              <div className="space-y-2.5">
                {filtered.map((entry) => (
                  <article
                    key={entry.id}
                    className="group rounded-xl border border-white/8 bg-white/[0.03] p-3.5 transition hover:border-white/20 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-snug text-white">{entry.title}</h3>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <IconButton title="编辑" small onClick={() => startEdit(entry)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton title="删除" small onClick={() => removeEntry(entry.id)}>
                          <TrashIcon />
                        </IconButton>
                      </div>
                    </div>
                    {entry.content ? (
                      <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-slate-300">{entry.content}</p>
                    ) : null}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
        <p className="mt-1 text-xs text-slate-500">
          {hasEntries ? "换个关键词或标签试试" : "点下面按钮，添加你的第一条知识"}
        </p>
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

function TagChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "bg-emerald-400 text-[#08121a]"
          : "border border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25"
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

/* ---- inline icons (no external deps) ---- */
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

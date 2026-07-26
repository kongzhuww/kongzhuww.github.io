"use client";

import { useState } from "react";
import { useCloudPref } from "./useCloudPref";

// A left-edge slide-out drawer of personal bookmarks: create folders, add links,
// click to jump. Syncs to Supabase when signed in (else local only).

type Link = { id: string; name: string; url: string };
type Folder = { id: string; name: string; open: boolean; links: Link[] };

const PANEL_W = 300;

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

function normalizeUrl(u: string) {
  const s = u.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

function favicon(url: string) {
  try {
    const h = new URL(normalizeUrl(url)).hostname;
    return `https://www.google.com/s2/favicons?domain=${h}&sz=64`;
  } catch {
    return "";
  }
}

export default function Bookmarks() {
  const [open, setOpen] = useState(false);
  const { value: folders, setValue: setFolders, ready, signedIn, signIn } = useCloudPref<Folder[]>("bookmarks", []);
  const [newFolder, setNewFolder] = useState("");
  const [adding, setAdding] = useState<string | null>(null); // folder id currently adding a link to
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  function addFolder() {
    const name = newFolder.trim();
    if (!name) return;
    setFolders((f) => [...f, { id: uid(), name, open: true, links: [] }]);
    setNewFolder("");
  }
  function delFolder(id: string) {
    setFolders((f) => f.filter((x) => x.id !== id));
  }
  function toggleFolder(id: string) {
    setFolders((f) => f.map((x) => (x.id === id ? { ...x, open: !x.open } : x)));
  }
  function addLink(fid: string) {
    const name = linkName.trim();
    const url = normalizeUrl(linkUrl);
    if (!url) return;
    setFolders((f) =>
      f.map((x) => (x.id === fid ? { ...x, links: [...x.links, { id: uid(), name: name || url, url }] } : x)),
    );
    setLinkName("");
    setLinkUrl("");
    setAdding(null);
  }
  function delLink(fid: string, lid: string) {
    setFolders((f) => f.map((x) => (x.id === fid ? { ...x, links: x.links.filter((l) => l.id !== lid) } : x)));
  }

  return (
    <div
      className="fixed left-0 top-1/2 z-[55] flex items-stretch transition-transform duration-300 ease-out"
      style={{ transform: open ? "translateY(-50%)" : `translateY(-50%) translateX(-${PANEL_W}px)` }}
    >
      {/* panel */}
      <section
        style={{ width: PANEL_W }}
        className="flex max-h-[76vh] flex-col overflow-hidden rounded-r-2xl border border-l-0 border-[var(--border)] bg-[var(--panel)] shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📁</span>
            <p className="text-sm font-semibold text-[var(--heading)]">我的收藏夹</p>
          </div>
          {signedIn ? (
            <span className="text-[11px] text-emerald-400" title="已云端同步">☁️ 已同步</span>
          ) : (
            <button onClick={signIn} className="text-[11px] text-[var(--muted)] underline-offset-2 hover:text-[var(--heading)] hover:underline" title="登录后云端同步、跨设备">
              登录同步
            </button>
          )}
        </header>

        <div className="border-b border-[var(--border)] p-3">
          <div className="flex gap-2">
            <input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFolder()}
              placeholder="新建文件夹名…"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--dim)] outline-none focus:border-emerald-400/40"
            />
            <button
              onClick={addFolder}
              className="shrink-0 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-[#08121a] transition hover:bg-emerald-300"
            >
              ＋
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {!ready ? null : folders.length === 0 ? (
            <div className="p-4 text-center text-sm text-[var(--muted)]">
              还没有收藏。<br />上面建个文件夹,再往里加网站吧。
            </div>
          ) : (
            <div className="space-y-1.5">
              {folders.map((f) => (
                <div key={f.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/50">
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <button
                      onClick={() => toggleFolder(f.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      <span className={`text-[10px] text-[var(--dim)] transition ${f.open ? "rotate-90" : ""}`}>▶</span>
                      <span className="truncate text-sm font-semibold text-[var(--heading)]">{f.name}</span>
                      <span className="text-[10px] text-[var(--dim)]">{f.links.length}</span>
                    </button>
                    <button
                      onClick={() => setAdding(adding === f.id ? null : f.id)}
                      title="添加网站"
                      className="grid h-6 w-6 place-items-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-emerald-400"
                    >
                      ＋
                    </button>
                    <button
                      onClick={() => delFolder(f.id)}
                      title="删除文件夹"
                      className="grid h-6 w-6 place-items-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </div>

                  {adding === f.id ? (
                    <div className="space-y-1.5 border-t border-[var(--border)] p-2">
                      <input
                        value={linkName}
                        onChange={(e) => setLinkName(e.target.value)}
                        placeholder="名称（可留空）"
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--dim)] outline-none focus:border-emerald-400/40"
                      />
                      <div className="flex gap-1.5">
                        <input
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addLink(f.id)}
                          placeholder="网址 如 github.com"
                          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--dim)] outline-none focus:border-emerald-400/40"
                        />
                        <button
                          onClick={() => addLink(f.id)}
                          className="shrink-0 rounded-md bg-emerald-400 px-2.5 py-1.5 text-xs font-semibold text-[#08121a] transition hover:bg-emerald-300"
                        >
                          添加
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {f.open && f.links.length > 0 ? (
                    <div className="space-y-0.5 px-1.5 pb-1.5">
                      {f.links.map((l) => (
                        <div key={l.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-[var(--surface-hover)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={favicon(l.url)} alt="" className="h-4 w-4 shrink-0 rounded" />
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 flex-1 truncate text-sm text-[var(--text)] transition hover:text-emerald-400"
                          >
                            {l.name}
                          </a>
                          <button
                            onClick={() => delLink(f.id, l.id)}
                            title="删除"
                            className="grid h-5 w-5 shrink-0 place-items-center rounded text-[var(--dim)] opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* handle (always peeking on the left edge) */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="收藏夹"
        className="my-auto flex h-24 w-8 flex-col items-center justify-center gap-1 rounded-r-xl border border-l-0 border-[var(--border)] bg-[var(--launcher)] text-[var(--heading)] shadow-lg transition hover:text-emerald-400"
      >
        <span className="text-base">{open ? "‹" : "📁"}</span>
        <span className="text-[10px] font-semibold [writing-mode:vertical-rl]">收藏夹</span>
      </button>
    </div>
  );
}

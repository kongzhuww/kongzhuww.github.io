"use client";

const HEYBOX_FAV = "https://www.xiaoheihe.cn/app/user/favour/content";

export default function Heybox() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-5 flex items-center gap-3">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-orange-400 to-amber-400" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-[var(--heading)]">小黑盒收藏</h2>
        <span className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted)]">
          🎮 跳转入口
        </span>
      </div>

      <a
        href={HEYBOX_FAV}
        target="_blank"
        rel="noreferrer"
        className="glass glass-hover group flex items-center gap-4 rounded-2xl p-5"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-400 text-2xl">
          🎮
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--heading)] transition group-hover:text-orange-400">
            打开我的小黑盒收藏
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            小黑盒收藏需要登录、且没有公开接口，无法内嵌——点此直接跳转到收藏页
          </p>
        </div>
        <span className="shrink-0 text-lg text-[var(--dim)] transition group-hover:translate-x-0.5 group-hover:text-[var(--text)]" aria-hidden="true">
          ↗
        </span>
      </a>
    </section>
  );
}

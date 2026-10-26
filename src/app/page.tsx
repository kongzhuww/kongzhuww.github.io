"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const REPO = "https://github.com/kongzhuww/tab-project-next";
const RELEASE_URL = "https://github.com/kongzhuww/tab-project-next/releases/latest";

const themes = [
  { id: "light", label: "Light · 明亮", note: "干净通透，把视觉重心留给重要内容与效率。" },
  { id: "lonetrail", label: "Lonetrail · 孤星纸面", note: "温暖纸张肌理，让日常慢下来、更专注治愈。" },
  { id: "dark", label: "Dark · 沉浸深色", note: "低对比度夜间调色，在夜里也柔和从容。" },
] as const;

type ThemeId = (typeof themes)[number]["id"];

interface WorkTask {
  id: string;
  repo: string;
  title: string;
  done: boolean;
  due?: string;
}

const initialTasks: WorkTask[] = [
  { id: "t1", repo: "OpenShell", title: "研究 Windows 终端无缝嵌入逻辑", done: false, due: "今天" },
  { id: "t2", repo: "OpenShell", title: "更新自动化构建流水线与脚本", done: true },
  { id: "t3", repo: "tab-project-next", title: "升级 1.0.1：持久通知中心与仓库分层", done: true },
  { id: "t4", repo: "tab-project-next", title: "优化落地展示站交互式桌面模拟器", done: false, due: "待办" },
];

const workspaceSites: Record<string, Array<{ name: string; icon: string; url: string; tone: string }>> = {
  "个人日常": [
    { name: "Bilibili", icon: "assets/bilibili.svg", url: "https://bilibili.com", tone: "rose" },
    { name: "网易云音乐", icon: "assets/netease.svg", url: "https://music.163.com", tone: "rose" },
    { name: "GitHub", icon: "assets/github-star.svg", url: "https://github.com", tone: "neutral" },
    { name: "YouTube", icon: "assets/nav-youtube.svg", url: "https://youtube.com", tone: "rose" },
    { name: "AI 资讯", icon: "assets/nav-aihot.svg", url: "#", tone: "sand" },
    { name: "添加网址", icon: "", url: "#", tone: "dashed" },
  ],
  "开发工作": [
    { name: "GitHub", icon: "assets/github-star.svg", url: "https://github.com", tone: "neutral" },
    { name: "Todoist", icon: "assets/nav-todoist.svg", url: "https://todoist.com", tone: "rose" },
    { name: "Vercel", icon: "assets/default-favicon.svg", url: "#", tone: "sand" },
    { name: "模型价格", icon: "assets/nav-pricing.svg", url: "#", tone: "lavender" },
    { name: "Cloudflare", icon: "assets/default-favicon.svg", url: "#", tone: "sand" },
    { name: "新建分组", icon: "", url: "#", tone: "dashed" },
  ],
  "灵感素材": [
    { name: "资源专区", icon: "assets/nav-folder.svg", url: "#", tone: "lavender" },
    { name: "Figma", icon: "assets/default-favicon.svg", url: "#", tone: "rose" },
    { name: "Dribbble", icon: "assets/default-favicon.svg", url: "#", tone: "rose" },
    { name: "Notion", icon: "assets/default-favicon.svg", url: "#", tone: "sand" },
    { name: "塞壬唱片", icon: "assets/nav-home.svg", url: "#", tone: "sand" },
    { name: "添加收藏", icon: "", url: "#", tone: "dashed" },
  ]
};

export default function Home() {
  const [theme, setTheme] = useState<ThemeId>("light");
  const [activeWorkspace, setActiveWorkspace] = useState("开发工作");
  const [activeWindow, setActiveWindow] = useState<string | null>("todoist");
  const [tasks, setTasks] = useState<WorkTask[]>(initialTasks);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState([
    { id: "n1", app: "Todoist", title: "任务提醒", desc: "升级 1.0.1：持久通知中心与仓库分层已发布", time: "刚刚" },
    { id: "n2", app: "GitHub", title: "新仓库关联", desc: "已在 tab-project-next 中关联至 GitHub 任务区", time: "10分钟前" },
  ]);
  const [clockTime, setClockTime] = useState("09:41");
  const [activeRepoGroup, setActiveRepoGroup] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockTime(
        String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0")
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const handleDockClick = (toolId: string) => {
    if (activeWindow === toolId) {
      setActiveWindow(null); // 点击当前已打开窗口则收起（绿点同步熄灭）
    } else {
      setActiveWindow(toolId);
    }
  };

  return (
    <div className="landing" data-theme={theme}>
      <a className="skip-link" href="#main">跳到正文</a>

      {/* 顶栏 Header */}
      <header className="site-header">
        <a className="brand" href="#" aria-label="tab-project-next 首页">
          <div className="brand-logo-wrap">
            <Image src="/assets/icon-48.png" alt="Logo" width={32} height={32} className="brand-logo-img" />
          </div>
          <div className="brand-text-wrap">
            <span className="brand-name">tab-project<span className="brand-next"> / next</span></span>
            <span className="brand-badge">v1.0.1 开源正式版</span>
          </div>
        </a>

        <nav aria-label="主导航">
          <a href="#features">功能特性</a>
          <a href="#simulator">在线体验</a>
          <a href="#appearance">主题外观</a>
          <a href="#install">安装使用</a>
        </nav>

        <div className="header-actions">
          <a className="repo-link" href={REPO} target="_blank" rel="noopener noreferrer">
            <Image src="/assets/github-star.svg" alt="" width={15} height={15} className="repo-star-icon" />
            <span>GitHub Star</span>
          </a>
        </div>
      </header>

      <main id="main">
        {/* Hero 主视觉区 */}
        <section className="hero container">
          <div className="hero-copy">
            <div className="hero-tags">
              <span className="eyebrow"><span className="status-dot" /> 纯净 Manifest V3 桌面浏览器扩展</span>
              <span className="hero-ver-chip">新版本 1.0.1 现已发布</span>
            </div>
            <h1>把属于你的日常，<br />安放在<span className="accent-word">顺手的新标签页。</span></h1>
            <p className="hero-description">
              常用的网站与深层文件夹，清晰归类的待办任务与 GitHub 仓库，<br className="desktop-break" />
              随心畅听的背景旋律。本地保存个人设置，按需连接你选择的服务。
            </p>
            <div className="actions">
              <a className="button primary" href={RELEASE_URL} target="_blank" rel="noopener noreferrer">
                <span>立即下载 v1.0.1 扩展包</span>
                <span className="btn-arrow" aria-hidden="true">↓</span>
              </a>
              <a className="button secondary" href={REPO} target="_blank" rel="noopener noreferrer">
                <span>浏览 GitHub 源码</span>
                <span className="btn-arrow" aria-hidden="true">↗</span>
              </a>
            </div>
            <p className="compatibility">
              原生支持 Microsoft Edge / Google Chrome 等全部 Chromium 内核浏览器 · 零本机 EXE 依赖
            </p>
          </div>

          <div className="hero-stat-card">
            <div className="stat-item">
              <span className="stat-number">本地</span>
              <span className="stat-label">保存设置与工作空间</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-number">按需</span>
              <span className="stat-label">连接第三方账号与服务</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-number">3 大</span>
              <span className="stat-label">无缝适配主题 · 告别暗黑割裂</span>
            </div>
          </div>
        </section>

        {/* 交互式拟真桌面模拟器 (Simulator) */}
        <section className="simulator-section container" id="simulator" aria-label="交互式插件体验">
          <div className="section-title-wrap text-center">
            <span className="eyebrow justify-center">INTERACTIVE PLAYGROUND</span>
            <h2>亲手试一试，像在真实浏览器里一样。</h2>
            <p className="section-sub">点击顶栏头像查看通知中心、切换工作区，或点击下方 Dock 呼出 Todoist 看板与音乐。</p>
          </div>

          <div className="browser-window-frame">
            {/* 浏览器外壳 */}
            <div className="browser-chrome-bar">
              <div className="browser-dots" aria-hidden="true">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <div className="browser-omnibox">
                <span className="browser-scheme">edge://newtab</span>
                <span className="browser-page-title"> — tab-project 新标签页</span>
              </div>
              <div className="browser-action-pills">
                <span className="pill-tag">实时交互模拟</span>
              </div>
            </div>

            {/* 插件新标签页主桌面 */}
            <div className="tab-desktop-canvas">
              {/* 顶栏 TopBar */}
              <div className="tab-topbar">
                {/* 左侧头像与通知中心入口 */}
                <div className="topbar-left relative">
                  <button
                    type="button"
                    className="topbar-profile-btn"
                    title="点击打开通知中心"
                    onClick={() => setShowNotificationCenter(!showNotificationCenter)}
                  >
                    <Image src="/assets/icon-48.png" alt="Avatar" width={26} height={26} className="profile-avatar" />
                    {unreadNotifications.length > 0 && (
                      <span className="notification-badge-dot">{unreadNotifications.length}</span>
                    )}
                  </button>

                  {/* 弹出持久通知中心 */}
                  {showNotificationCenter && (
                    <div className="sim-notification-popover">
                      <div className="sim-notif-header">
                        <div>
                          <h4>通知中心</h4>
                          <small>重要通知保留 30 天 · 仅本地</small>
                        </div>
                        <button
                          type="button"
                          className="sim-notif-close"
                          onClick={() => setShowNotificationCenter(false)}
                        >×</button>
                      </div>
                      <div className="sim-notif-list">
                        {unreadNotifications.length === 0 ? (
                          <div className="sim-notif-empty">暂无未读通知</div>
                        ) : (
                          unreadNotifications.map(n => (
                            <div key={n.id} className="sim-notif-item">
                              <div className="sim-notif-meta">
                                <strong>{n.app}</strong>
                                <span>{n.time}</span>
                              </div>
                              <p className="sim-notif-title">{n.title}</p>
                              <p className="sim-notif-desc">{n.desc}</p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="sim-notif-footer">
                        <button
                          type="button"
                          onClick={() => setUnreadNotifications([])}
                          disabled={unreadNotifications.length === 0}
                        >全部已读</button>
                      </div>
                    </div>
                  )}

                  {/* 多工作区选择 */}
                  <div className="workspace-selector">
                    {Object.keys(workspaceSites).map(ws => (
                      <button
                        key={ws}
                        type="button"
                        className={"ws-chip " + (activeWorkspace === ws ? "active" : "")}
                        onClick={() => setActiveWorkspace(ws)}
                      >
                        {ws}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 右侧设置与主题切换 */}
                <div className="topbar-right">
                  <div className="theme-quick-switch">
                    {themes.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        className={"theme-dot-btn " + (theme === t.id ? "active" : "")}
                        title={"切换主题: " + t.label}
                        onClick={() => setTheme(t.id)}
                      >
                        <span className={"theme-dot " + t.id} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 首屏时钟与名言 */}
              <div className="tab-hero-center">
                <span className="tab-clock-display">{clockTime}</span>
                <p className="tab-motto-quote">把常去的地方放在手边，给专注留一片净土。</p>

                {/* 搜索框 */}
                <div className="tab-search-box">
                  <span className="search-icon">🔍</span>
                  <span className="search-placeholder">在网页、B站、GitHub 搜索，或优先检索本地书签…</span>
                  <kbd className="search-shortcut">Ctrl+K</kbd>
                </div>
              </div>

              {/* 常用网站网格展示 */}
              <div className="tab-sites-grid">
                {workspaceSites[activeWorkspace].map((site, idx) => (
                  <div key={idx} className={"sim-site-card " + site.tone}>
                    <div className="sim-site-icon-box">
                      {site.icon ? (
                        <Image src={"/" + site.icon} alt={site.name} width={26} height={26} className="sim-site-img" />
                      ) : (
                        <span className="sim-site-plus">＋</span>
                      )}
                    </div>
                    <span className="sim-site-title">{site.name}</span>
                  </div>
                ))}
              </div>

              {/* 浮动应用窗口展示 (Todoist / 音乐 / GitHub) */}
              {activeWindow === "todoist" && (
                <div className="sim-app-window sim-todoist-window">
                  <div className="sim-win-header">
                    <div className="sim-win-title">
                      <Image src="/assets/nav-todoist.svg" alt="" width={16} height={16} />
                      <span>Todoist 看板 · 工作任务</span>
                    </div>
                    <div className="sim-win-actions">
                      <span className="sim-win-badge">SWR 0ms 本地直出</span>
                      <button
                        type="button"
                        className="sim-win-close-btn"
                        title="关闭窗口并熄灭绿点"
                        onClick={() => setActiveWindow(null)}
                      >✕</button>
                    </div>
                  </div>

                  <div className="sim-win-body">
                    {/* 分层展示：以关联仓库进行独立分组 */}
                    <div className="sim-todoist-col">
                      <div className="sim-col-header">
                        <strong>github 任务区</strong>
                        <span className="sim-col-tag">按关联仓库分层排版</span>
                      </div>

                      {/* 仓库层 1: OpenShell */}
                      <div className="sim-repo-layer">
                        <div
                          className="sim-repo-header"
                          onClick={() => setActiveRepoGroup(activeRepoGroup === "OpenShell" ? null : "OpenShell")}
                        >
                          <span className="repo-mark">🐙</span>
                          <strong className="repo-name">OpenShell</strong>
                          <span className="repo-counter">2 条任务</span>
                          <span className="repo-arrow">{activeRepoGroup === "OpenShell" ? "▸" : "▾"}</span>
                        </div>
                        {activeRepoGroup !== "OpenShell" && (
                          <div className="sim-task-cards-list">
                            {tasks.filter(t => t.repo === "OpenShell").map(t => (
                              <div
                                key={t.id}
                                className={"sim-task-item " + (t.done ? "is-done" : "")}
                                onClick={() => toggleTask(t.id)}
                              >
                                <span className="sim-check-round">{t.done ? "✓" : ""}</span>
                                <span className="sim-task-text">{t.title}</span>
                                {t.due && <span className="sim-task-due">{t.due}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 仓库层 2: tab-project-next */}
                      <div className="sim-repo-layer">
                        <div
                          className="sim-repo-header"
                          onClick={() => setActiveRepoGroup(activeRepoGroup === "tab-project" ? null : "tab-project")}
                        >
                          <span className="repo-mark">🐙</span>
                          <strong className="repo-name">tab-project-next</strong>
                          <span className="repo-counter">2 条任务</span>
                          <span className="repo-arrow">{activeRepoGroup === "tab-project" ? "▸" : "▾"}</span>
                        </div>
                        {activeRepoGroup !== "tab-project" && (
                          <div className="sim-task-cards-list">
                            {tasks.filter(t => t.repo === "tab-project-next").map(t => (
                              <div
                                key={t.id}
                                className={"sim-task-item " + (t.done ? "is-done" : "")}
                                onClick={() => toggleTask(t.id)}
                              >
                                <span className="sim-check-round">{t.done ? "✓" : ""}</span>
                                <span className="sim-task-text">{t.title}</span>
                                {t.due && <span className="sim-task-due">{t.due}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeWindow === "music" && (
                <div className="sim-app-window sim-music-window">
                  <div className="sim-win-header">
                    <div className="sim-win-title">
                      <Image src="/assets/netease.svg" alt="" width={16} height={16} />
                      <span>网易云音乐 · 官网会话直连</span>
                    </div>
                    <button
                      type="button"
                      className="sim-win-close-btn"
                      onClick={() => setActiveWindow(null)}
                    >✕</button>
                  </div>
                  <div className="sim-music-body">
                    <div className="sim-vinyl-record" aria-hidden="true">
                      <div className="vinyl-groove" />
                      <div className="vinyl-core">♫</div>
                    </div>
                    <div className="sim-music-info">
                      <strong>自然回响 · 沉浸白噪音与经典歌单</strong>
                      <p>官网安全会话连接 · 无需本地中间代理节点</p>
                      <div className="sim-music-bar">
                        <span className="bar-fill" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 底部仿 MacDock 栏 */}
              <div className="tab-bottom-dock" role="toolbar" aria-label="底栏应用快捷坞">
                <button
                  type="button"
                  className={"dock-btn " + (activeWindow === "home" ? "active" : "")}
                  title="常用主页"
                  onClick={() => setActiveWindow(null)}
                >
                  <Image src="/assets/nav-home.svg" alt="Home" width={22} height={22} />
                </button>
                <div className="dock-divider" />
                <button
                  type="button"
                  className={"dock-btn " + (activeWindow === "todoist" ? "active" : "")}
                  title="Todoist 任务看板"
                  onClick={() => handleDockClick("todoist")}
                >
                  <Image src="/assets/nav-todoist.svg" alt="Todoist" width={22} height={22} />
                  {activeWindow === "todoist" && <span className="dock-active-dot" />}
                </button>
                <button
                  type="button"
                  className={"dock-btn " + (activeWindow === "music" ? "active" : "")}
                  title="网易云与播放器"
                  onClick={() => handleDockClick("music")}
                >
                  <Image src="/assets/netease.svg" alt="Music" width={22} height={22} />
                  {activeWindow === "music" && <span className="dock-active-dot" />}
                </button>
                <button
                  type="button"
                  className="dock-btn"
                  title="B站收藏与视频"
                  onClick={() => handleDockClick("bili")}
                >
                  <Image src="/assets/bilibili.svg" alt="B站" width={22} height={22} />
                  {activeWindow === "bili" && <span className="dock-active-dot" />}
                </button>
                <button
                  type="button"
                  className="dock-btn"
                  title="GitHub 资源专区"
                  onClick={() => handleDockClick("github")}
                >
                  <Image src="/assets/github-star.svg" alt="GitHub" width={22} height={22} />
                  {activeWindow === "github" && <span className="dock-active-dot" />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 核心亮点特性矩阵 Bento Grid */}
        <section className="features-section container section-space" id="features">
          <div className="section-heading">
            <div>
              <p className="eyebrow">FEATURES OVERVIEW</p>
              <h2>不仅好看，更专为效率而生。</h2>
            </div>
            <p className="heading-sub">彻底拔除外部庞杂依赖，专注纯净、敏捷、自洽的桌面新标签页体验。</p>
          </div>

          <div className="bento-grid">
            {/* 卡片 1: 常用网站 */}
            <article className="bento-card bento-wide">
              <div className="bento-badge">01 · 常用网站与书签</div>
              <h3>多工作区与深层嵌套文件夹</h3>
              <p>支持创建多个专属工作区，网站卡片就地右键重命名、换位动画丝滑；文件夹支持多层嵌套，打开时专注内部交互，零误触。</p>
              <div className="bento-visual sites-preview">
                <span className="chip sage">个人工作区</span>
                <span className="chip rose">开发常用</span>
                <span className="chip sand">深度学习</span>
              </div>
            </article>

            {/* 卡片 2: Todoist 看板 */}
            <article className="bento-card bento-wide highlight">
              <div className="bento-badge">02 · 生产力进化</div>
              <h3>Todoist 看板与 GitHub 仓库分层</h3>
              <p>本地 Storage 离线 0ms 瞬间直出，告别白屏转圈；被指定为 GitHub 任务区的板块自动按仓库分层排布，任务进度一目了然。</p>
              <div className="bento-visual todoist-preview">
                <div className="mini-task-row">
                  <span className="mini-check">✓</span>
                  <span>关联仓库任务自动聚合展示</span>
                </div>
                <div className="mini-task-row">
                  <span className="mini-check">✓</span>
                  <span>支持番茄钟限时与 DayLine 日历联动</span>
                </div>
              </div>
            </article>

            {/* 卡片 3: 持久通知中心 */}
            <article className="bento-card">
              <div className="bento-badge">03 · 全新推出</div>
              <h3>持久通知中心</h3>
              <p>左上角头像聚合错过的任务闹钟、Toast 提醒与重要异常，保留 30 天，支持一键全部已读与快捷跳转关联任务。</p>
            </article>

            {/* 卡片 4: GitHub 资源专区 */}
            <article className="bento-card">
              <div className="bento-badge">04 · 开源探索</div>
              <h3>GitHub 资源专区</h3>
              <p>整理 Star 仓库、探索精选开源资源；全新修复的 README Markdown 排版引擎，横排导航开阔舒展，舒心阅读。</p>
            </article>

            {/* 卡片 5: 音乐陪伴 */}
            <article className="bento-card">
              <div className="bento-badge">05 · 旋律与白噪</div>
              <h3>官网会话音乐直连</h3>
              <p>网易云音乐直接通过同一浏览器的官方会话连接，配合塞壬唱片模块，轻巧纯净，无需配置复杂的外部服务。</p>
            </article>

            {/* 卡片 6: 纯净隐私 */}
            <article className="bento-card">
              <div className="bento-badge">06 · 隐私与安全</div>
              <h3>100% 浏览器原生</h3>
              <p>设置与内容主要保存在浏览器本地。联网组件会向相应服务发送必要数据，同步备份可能包含凭据；使用前请查看隐私政策。</p>
            </article>
          </div>
        </section>

        {/* 动态主题切换预览区 */}
        <section className="appearance-section section-space" id="appearance">
          <div className="container appearance-inner">
            <div>
              <p className="eyebrow">DESIGN SYSTEM</p>
              <h2>拒绝暗黑割裂，适配你的每一刻心情。</h2>
              <p>全量基于 CSS 变量系统，无论是清新明亮、复古温暖纸面，还是静谧黑夜，对比度和谐自洽，界面绝不出现死黑一块的粗糙质感。</p>
            </div>
            <div className="theme-picker-box">
              <div className="theme-options-cards">
                {themes.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={"theme-card-option " + (theme === item.id ? "selected" : "")}
                    onClick={() => setTheme(item.id)}
                  >
                    <div className={"theme-preview-palette palette-" + item.id}>
                      <span className="palette-bar" />
                      <span className="palette-chip" />
                    </div>
                    <strong>{item.label}</strong>
                    <small>{item.note}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 安装与开始使用 */}
        <section className="install-section container section-space" id="install">
          <div className="section-heading">
            <div>
              <p className="eyebrow">GET STARTED</p>
              <h2>三步安装，即刻开启。</h2>
            </div>
            <a className="text-link" href={RELEASE_URL} target="_blank" rel="noopener noreferrer">前往 GitHub Releases 下载 ZIP ↗</a>
          </div>

          <div className="install-steps-row">
            <div className="install-step-card">
              <span className="step-idx">01</span>
              <h4>下载解压</h4>
              <p>在 GitHub 发行页面下载最新的 <code>tab-project-v1.0.1-extension.zip</code>，解压到电脑的固定目录。</p>
            </div>
            <div className="install-step-card">
              <span className="step-idx">02</span>
              <h4>开启扩展模式</h4>
              <p>在浏览器地址栏打开 <code>edge://extensions</code> 或 <code>chrome://extensions</code>，开启右上角“开发者模式”。</p>
            </div>
            <div className="install-step-card">
              <span className="step-idx">03</span>
              <h4>加载已解压项</h4>
              <p>点击“加载解压缩的扩展”，选择刚刚解压的目录。新开一个标签页，即可立刻体验你的专属空间！</p>
            </div>
          </div>
        </section>

        {/* 底部 Call To Action */}
        <section className="closing-section container">
          <div className="closing-box">
            <Image src="/assets/icon-128.png" alt="Logo" width={64} height={64} className="closing-logo" />
            <h2>打开新一页，回到属于你的从容。</h2>
            <p>tab-project-next · 基于纯净 Manifest V3 构建的现代化开源新标签页</p>
            <div className="actions justify-center">
              <a className="button primary" href={RELEASE_URL} target="_blank" rel="noopener noreferrer">
                <span>下载 1.0.1 正式版</span>
                <span className="btn-arrow" aria-hidden="true">↓</span>
              </a>
              <a className="button secondary" href={REPO} target="_blank" rel="noopener noreferrer">
                <span>在 GitHub 上关注项目</span>
                <span className="btn-arrow" aria-hidden="true">★</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* 页脚 Footer */}
      <footer className="site-footer container">
        <div className="footer-left">
          <span className="footer-brand">tab-project-next</span>
          <span className="footer-copyright">© {new Date().getFullYear()} kongzhuww · 保持专注，探索日常。</span>
        </div>
        <div className="footer-links">
          <Link href="/privacy">隐私政策</Link>
          <a href={REPO} target="_blank" rel="noopener noreferrer">GitHub 仓库</a>
          <a href={RELEASE_URL} target="_blank" rel="noopener noreferrer">发行版本</a>
          <a href={REPO + "/issues"} target="_blank" rel="noopener noreferrer">问题反馈</a>
        </div>
      </footer>
    </div>
  );
}

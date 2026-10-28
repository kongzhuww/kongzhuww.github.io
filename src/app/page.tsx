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
  { id: "t1", repo: "WebWorkspace", title: "研究前端虚拟网格与平滑拖拽交互", done: false, due: "今天" },
  { id: "t2", repo: "WebWorkspace", title: "更新自动化构建流水线与持续集成配置", done: true },
  { id: "t3", repo: "tab-project-next", title: "体验 1.0.5：我的仓库 Topic 看板与分类", done: true },
  { id: "t4", repo: "tab-project-next", title: "自定义常用网站九宫格与深层文件夹", done: false, due: "待办" },
];

// 顶栏书签条文件夹占位 (BookmarkFolderStrip.vue)
const topBookmarkFolders = ["开发资源", "效率工具", "设计灵感", "参考文档", "学习笔记"];

// 常用网站分区占位 (FavoriteSites.vue)
const sitePageTabs = ["默认", "工作台", "开发", "设计", "日常", "阅读", "归档"];

// 2x2 大文件夹与单格磁贴通用占位数据 (保持 2x2 大九宫格、小四宫格与磁贴布局，严格去个人化)
interface SimTileItem {
  id: string;
  type: "folder-large" | "folder-small" | "link";
  title: string;
  badge?: string;
  subIcons?: Array<{ text: string; bg: string; color?: string }>;
  iconText?: string;
  iconBg?: string;
  iconColor?: string;
  iconSrc?: string;
}

const pageTilesMap: Record<string, SimTileItem[]> = {
  "默认": [
    {
      id: "f-plat",
      type: "folder-large",
      title: "常用社区",
      subIcons: [
        { text: "Web", bg: "#fb7299", color: "#fff" },
        { text: "Hub", bg: "#24292f", color: "#fff" },
        { text: "Dev", bg: "#0f172a", color: "#fff" },
        { text: "Doc", bg: "#f8fafc", color: "#334155" },
        { text: "Chat", bg: "#0284c7", color: "#fff" },
        { text: "App", bg: "#10b981", color: "#fff" },
        { text: "Feed", bg: "#f59e0b", color: "#fff" },
        { text: "Git", bg: "#6366f1", color: "#fff" },
        { text: "+3", bg: "#475569", color: "#fff" },
      ]
    },
    {
      id: "f-ai",
      type: "folder-large",
      title: "常用AI",
      subIcons: [
        { text: "✦", bg: "#eff6ff", color: "#2563eb" },
        { text: "🤖", bg: "#0f172a", color: "#fff" },
        { text: "💬", bg: "#1e293b", color: "#fff" },
        { text: "🧠", bg: "#e0e7ff", color: "#4f46e5" },
        { text: "✴", bg: "#fef3c7", color: "#d97706" },
        { text: "◎", bg: "#f1f5f9", color: "#0f172a" },
        { text: "K", bg: "#18181b", color: "#fff" },
        { text: "🌅", bg: "#fff7ed", color: "#ea580c" },
      ]
    },
    {
      id: "f-git",
      type: "folder-small",
      title: "代码协作",
      subIcons: [
        { text: "Git", bg: "#f8fafc", color: "#0f172a" },
        { text: "Hub", bg: "#f8fafc", color: "#0f172a" },
        { text: "Lab", bg: "#f8fafc", color: "#475569" },
      ]
    },
    {
      id: "f-mail",
      type: "folder-small",
      title: "协同办公",
      subIcons: [
        { text: "Mail", bg: "#eff6ff", color: "#0284c7" },
        { text: "Doc", bg: "#fef2f2", color: "#dc2626" },
        { text: "Cal", bg: "#f0fdf4", color: "#16a34a" },
      ]
    },
    {
      id: "f-api",
      type: "folder-small",
      title: "API服务",
      subIcons: [
        { text: "API", bg: "#f0f9ff", color: "#0284c7" },
        { text: "Post", bg: "#0f172a", color: "#fff" },
        { text: "Test", bg: "#18181b", color: "#fff" },
        { text: "+2", bg: "#475569", color: "#fff" },
      ]
    },
    {
      id: "l-demo-ws",
      type: "link",
      title: "工作台...",
      iconText: "💻",
      iconBg: "#09090b",
      iconColor: "#38bdf8"
    },
    {
      id: "f-forum",
      type: "folder-small",
      title: "技术论坛",
      subIcons: [
        { text: "UI", bg: "#fff7ed", color: "#ea580c" },
        { text: "Doc", bg: "#f8fafc", color: "#334155" },
        { text: "Tech", bg: "#eff6ff", color: "#2563eb" },
      ]
    },
    {
      id: "l-preview",
      type: "link",
      title: "组件预览",
      iconText: "🧩",
      iconBg: "#3b82f6",
      iconColor: "#fff"
    },
    {
      id: "f-aitools",
      type: "folder-small",
      title: "开发工具",
      subIcons: [
        { text: "CLI", bg: "#f3e8ff", color: "#9333ea" },
        { text: "Pkg", bg: "#f3e8ff", color: "#9333ea" },
        { text: "Env", bg: "#f8fafc", color: "#334155" },
        { text: "+4", bg: "#475569", color: "#fff" },
      ]
    },
    {
      id: "l-doc",
      type: "link",
      title: "在线文档",
      iconText: "📖",
      iconBg: "#ffffff",
      iconColor: "#0f172a"
    },
    {
      id: "l-pkg",
      type: "link",
      title: "包管理器",
      iconText: "📦",
      iconBg: "#ffffff",
      iconColor: "#0f172a"
    },
    {
      id: "l-board",
      type: "link",
      title: "数据看板",
      iconText: "📊",
      iconBg: "#ffffff",
      iconColor: "#0f172a"
    },
    {
      id: "l-spec",
      type: "link",
      title: "设计规范",
      iconText: "📐",
      iconBg: "#eff6ff",
      iconColor: "#1d4ed8"
    },
    {
      id: "l-mind",
      type: "link",
      title: "思维导图",
      iconText: "🧠",
      iconBg: "#ffffff",
      iconColor: "#0f172a"
    },
    {
      id: "l-speed",
      type: "link",
      title: "网络测速",
      iconText: "⚡",
      iconBg: "#ffffff",
      iconColor: "#0f172a"
    },
    {
      id: "l-convert",
      type: "link",
      title: "格式转换",
      iconText: "🔄",
      iconBg: "#eff6ff",
      iconColor: "#2563eb"
    },
    {
      id: "l-color",
      type: "link",
      title: "配色参考",
      iconText: "🎨",
      iconBg: "#f0fdf4",
      iconColor: "#15803d"
    },
    {
      id: "l-icon",
      type: "link",
      title: "图标资产",
      iconText: "💠",
      iconBg: "#eef2ff",
      iconColor: "#4f46e5"
    },
    {
      id: "l-sandbox",
      type: "link",
      title: "代码沙盒",
      iconText: "⌨️",
      iconBg: "#ffffff",
      iconColor: "#0f172a"
    },
    {
      id: "l-weekly",
      type: "link",
      title: "技术周报",
      iconText: "📰",
      iconBg: "#fff7ed",
      iconColor: "#ea580c"
    },
    {
      id: "l-note",
      type: "link",
      title: "快速便签",
      iconText: "📝",
      iconBg: "#0f172a",
      iconColor: "#38bdf8"
    }
  ]
};

// AI HOT 资讯池 (LauncherAiHotCard.vue)
const aihotPool = [
  {
    rank: 1,
    title: "让编程智能体使用已登录 Chrome 的六种方案实操指南",
    summary: "Browser Use 作者整理了让 Claude Code、Codex、Gemini CLI、Cursor 等编程智能体使用已登录 Chrome 的方法：Claude 订阅用户可用 claude --chrome 的 Claude in Chrome 扩展。",
    tag: "💡 观点",
    source: "Browser Use",
    time: "2026-10-25 08:00"
  },
  {
    rank: 2,
    title: "DeepSeek 发布新一代推理与开源模型架构，算力能效与推理表现获全球瞩目",
    summary: "新一代模型在长文本理解、复杂数学推导与代码生成领域实现大幅跃升，全面革新开源生态格局与部署成本。",
    tag: "🤖 模型",
    source: "AI 科技评论",
    time: "2026-10-28 09:30"
  },
  {
    rank: 3,
    title: "具身智能开源机器人框架发布，多模态大模型进入物理现实交互新阶段",
    summary: "从视觉语言感知到肢体灵巧操作的端到端神经驱动方案，大幅降低机器人动作泛化与仿真学习门槛。",
    tag: "🦾 具身",
    source: "新智元",
    time: "2026-10-28 11:15"
  }
];

export default function Home() {
  const [theme, setTheme] = useState<ThemeId>("light");
  const [sitesView, setSitesView] = useState<"sites" | "bookmarks">("sites");
  const [activeSitePage, setActiveSitePage] = useState("默认");
  const [activeWindow, setActiveWindow] = useState<string | null>(null);
  const [tasks, setTasks] = useState<WorkTask[]>(initialTasks);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState([
    { id: "n1", app: "Todoist", title: "任务提醒", desc: "升级 1.0.5：我的仓库 Topic 看板与拖拽同步已发布", time: "刚刚" },
    { id: "n2", app: "GitHub", title: "新仓库关联", desc: "已在 tab-project-next 中关联至 GitHub 任务区", time: "10分钟前" },
  ]);

  const [clockTime, setClockTime] = useState("10:17");
  const [clockSecs, setClockSecs] = useState(":46");
  const [clockGreeting, setClockGreeting] = useState("上午好");
  const [clockDate, setClockDate] = useState("2026年10月26日 · 周一");

  const [activeRepoGroup, setActiveRepoGroup] = useState<string | null>(null);
  const [biliTab, setBiliTab] = useState("sub");
  const [ghTab, setGhTab] = useState("repos");
  const [aihotIdx, setAihotIdx] = useState(0);
  const [isVinylPlaying, setIsVinylPlaying] = useState(false);

  // GitHub Topic 看板可交互模拟状态
  const [kanbanRepos, setKanbanRepos] = useState([
    { id: "r1", name: "workspace-template", desc: "Clean modern dashboard starter kit", lang: "TypeScript", stars: 128, topic: "default" },
    { id: "r2", name: "tab-project-website", desc: "Official showcase site for tab-project-next", lang: "TypeScript", stars: 45, topic: "default" },
    { id: "r3", name: "tab-project-next", desc: "Modern Chromium MV3 newtab workspace with Vue 3", lang: "Vue", stars: 482, topic: "tools" },
    { id: "r4", name: "cli-workflow-tool", desc: "CLI multi-project manager and terminal automation", lang: "Go", stars: 96, topic: "tools" },
    { id: "r5", name: "markdown-notes-organizer", desc: "Web clipper & markdown knowledge organizer", lang: "TypeScript", stars: 72, topic: "vue3" },
  ]);

  useEffect(() => {
    const wk = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const updateTime = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();
      setClockTime(String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"));
      setClockSecs(":" + String(s).padStart(2, "0"));
      if (h < 5) setClockGreeting("夜深了");
      else if (h < 9) setClockGreeting("早上好");
      else if (h < 12) setClockGreeting("上午好");
      else if (h < 14) setClockGreeting("中午好");
      else if (h < 18) setClockGreeting("下午好");
      else setClockGreeting("晚上好");
      setClockDate(`${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · ${wk[now.getDay()]}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const handleDockClick = (toolId: string) => {
    if (toolId === "home") {
      setActiveWindow(null);
      return;
    }
    if (activeWindow === toolId) {
      setActiveWindow(null); // 点击当前已打开窗口则收起（绿点同步熄灭）
    } else {
      setActiveWindow(toolId);
    }
  };

  const moveRepoTopic = (repoId: string, nextTopic: string) => {
    setKanbanRepos(prev => prev.map(r => r.id === repoId ? { ...r, topic: nextTopic } : r));
  };

  const currentTiles = pageTilesMap[activeSitePage] || pageTilesMap["默认"];
  const currentAihot = aihotPool[aihotIdx % aihotPool.length];

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
            <span className="brand-badge">v1.0.5 开源正式版</span>
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
              <span className="hero-ver-chip">新版本 1.0.5 现已发布</span>
            </div>
            <h1>把属于你的日常，<br />安放在<span className="accent-word">顺手的新标签页。</span></h1>
            <p className="hero-description">
              常用的网站与深层文件夹，清晰归类的待办任务与 GitHub 仓库，<br className="desktop-break" />
              随心畅听的背景旋律。本地保存个人设置，按需连接你选择的服务。
            </p>
            <div className="actions">
              <a className="button primary" href={RELEASE_URL} target="_blank" rel="noopener noreferrer">
                <span>立即下载 v1.0.5 扩展包</span>
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
              <span className="stat-number">4 套</span>
              <span className="stat-label">正式界面主题 · 告别暗黑割裂</span>
            </div>
          </div>
        </section>

        {/* 1:1 像素级复刻真实扩展桌面模拟器 (Simulator) */}
        <section className="simulator-section container" id="simulator" aria-label="交互式插件体验">
          <div className="section-title-wrap text-center">
            <span className="eyebrow justify-center">INTERACTIVE PLAYGROUND</span>
            <h2>1:1 真实还原，亲手试一试你的新标签页。</h2>
            <p className="section-sub">
              直接点击下方 Dock 栏的 <strong>B站插件、GitHub 插件（体验 v1.0.5 仓库 Topic 看板）、AI Hot、Todoist、网易云</strong>，或点击黑胶唱片与资讯换一批。
            </p>
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
                <span className="browser-page-title"> — tab-project 新标签页 (v1.0.5 实机复刻)</span>
              </div>
              <div className="browser-action-pills">
                <span className="pill-tag">点击 Dock 图标打开对应工作台</span>
              </div>
            </div>

            {/* ================= 扩展真实顶栏 (AppTopBar.vue) ================= */}
            <div className="real-ext-topbar">
              <div className="real-tb-brand">
                {/* 左上角头像与持久通知中心 */}
                <div className="real-avatar-anchor">
                  <button
                    type="button"
                    className="real-profile-btn"
                    title="点击打开持久通知中心"
                    onClick={() => setShowNotificationCenter(!showNotificationCenter)}
                  >
                    <Image src="/assets/icon-48.png" alt="Avatar" width={30} height={30} className="real-profile-img" />
                    {unreadNotifications.length > 0 && (
                      <span className="real-profile-badge">{unreadNotifications.length}</span>
                    )}
                  </button>

                  {showNotificationCenter && (
                    <div className="sim-notification-popover">
                      <div className="sim-notif-header">
                        <h4>通知中心</h4>
                        <small>保留 30 天内重要提醒</small>
                        <button type="button" className="sim-notif-close" onClick={() => setShowNotificationCenter(false)}>×</button>
                      </div>
                      <div className="sim-notif-list">
                        {unreadNotifications.length === 0 ? (
                          <p className="sim-notif-empty">暂无未读通知</p>
                        ) : (
                          unreadNotifications.map(n => (
                            <div key={n.id} className="sim-notif-item">
                              <div className="sim-notif-meta">
                                <strong>{n.app}</strong>
                                <span>{n.time}</span>
                              </div>
                              <div className="sim-notif-title">{n.title}</div>
                              <div className="sim-notif-desc">{n.desc}</div>
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
                </div>

                {/* 顶栏书签文件夹条 (BookmarkFolderStrip.vue) */}
                <div className="real-bookmark-strip">
                  {topBookmarkFolders.map(folder => (
                    <button key={folder} type="button" className="real-bm-chip" onClick={() => setSitesView("bookmarks")}>
                      <span className="real-bm-icon">📁</span>
                      <span>{folder}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 中间滚动立方体 (TopInfoCube.vue) */}
              <div className="real-top-cube">
                <div className="real-cube-side">
                  <button type="button" className="real-cube-btn" title="上一首">⏮</button>
                  <button
                    type="button"
                    className="real-cube-btn"
                    title="播放/暂停"
                    onClick={() => setIsVinylPlaying(!isVinylPlaying)}
                  >
                    {isVinylPlaying ? "⏸" : "▶"}
                  </button>
                </div>
                <div className="real-cube-main" onClick={() => handleDockClick("music")}>
                  <span className="real-cube-title">塞壬唱片 · 点击播放</span>
                  <span className="real-cube-artist">明日方舟音乐库</span>
                  <span className="real-cube-badge">{isVinylPlaying ? "播放中" : "待机"}</span>
                  <span className="real-cube-divider" />
                  <span className="real-cube-lyric">选择塞壬歌曲、网易云或B站电台…</span>
                </div>
                <div className="real-cube-side">
                  <button type="button" className="real-cube-btn" title="下一首">⏭</button>
                  <button type="button" className="real-cube-btn" title="打开音乐库" onClick={() => handleDockClick("music")}>🎵</button>
                </div>
                <span className="real-cube-dot" />
              </div>

              {/* 右侧设置与主题按钮 */}
              <div className="real-tb-actions">
                <button type="button" className="real-tb-circle-btn" title="打开设置">⚙</button>
                <button
                  type="button"
                  className="real-tb-circle-btn"
                  title="切换页面主题"
                  onClick={() => {
                    const order: ThemeId[] = ["light", "lonetrail", "dark"];
                    setTheme(order[(order.indexOf(theme) + 1) % order.length]);
                  }}
                >
                  {theme === "dark" ? "🌙" : theme === "lonetrail" ? "🌌" : "☀️"}
                </button>
              </div>
            </div>

            {/* ================= 扩展主桌面画布（真实雪山壁纸 + 双层网格 + MacDock） ================= */}
            <div className="real-launcher-canvas">
              {/* 第一排：三栏概览 (天气 + 时钟搜索 + 黑胶播放器) */}
              <div className="real-launcher-overview">
                {/* 1. 左栏：天气卡片 (WeatherWidget.vue) */}
                <section className="real-glass-card real-weather-card">
                  <header className="real-card-head">
                    <span className="real-bar cyan" />
                    <h3>天气</h3>
                  </header>
                  <div className="real-wx-body">
                    <div className="real-wx-cur">
                      <span className="real-wx-emoji">🌤️</span>
                      <span className="real-wx-temp">21°</span>
                    </div>
                    <p className="real-wx-sub">少云 · 最高 25° / 最低 18°</p>
                    <p className="real-wx-rain">未来 12 小时暂无降水 ☂️</p>
                    <div className="real-wx-hours">
                      <div className="real-wx-h"><span>现在</span><span>☀️</span><strong>22°</strong></div>
                      <div className="real-wx-h"><span>11时</span><span>🌤️</span><strong>24°</strong></div>
                      <div className="real-wx-h"><span>12时</span><span>🌤️</span><strong>25°</strong></div>
                      <div className="real-wx-h"><span>13时</span><span>☁️</span><strong>25°</strong></div>
                      <div className="real-wx-h"><span>14时</span><span>☁️</span><strong>25°</strong></div>
                    </div>
                    <div className="real-wx-days">
                      <span>明天 🌦️ 22°/17°</span>
                      <span>后天 🌧️ 20°/16°</span>
                    </div>
                  </div>
                </section>

                {/* 2. 中栏：问候语 + 粗体等宽时钟带秒数 + 日期 + 纯白胶囊搜索框 */}
                <div className="real-launcher-center">
                  <div className="real-hero-clock">
                    <p className="real-greeting">{clockGreeting}</p>
                    <p className="real-clock-digits">
                      {clockTime}<span className="real-clock-secs">{clockSecs}</span>
                    </p>
                    <p className="real-clock-date">{clockDate}</p>
                  </div>

                  <div className="real-search-pill">
                    <span className="real-search-icon">⌕</span>
                    <span className="real-search-placeholder">搜索，或输入网址直接打开</span>
                    <button type="button" className="real-search-history-chip">
                      <span>🕒 历史记录</span>
                    </button>
                  </div>
                </div>

                {/* 3. 右栏：黑胶播放器卡片 (HomeMusicCard.vue) */}
                <section className="real-glass-card real-player-card">
                  <header className="real-card-head">
                    <span className="real-bar red" />
                    <h3>播放器</h3>
                    <span className="real-grow" />
                    <button
                      type="button"
                      className="real-head-pill-btn"
                      onClick={() => handleDockClick("music")}
                    >
                      网易云 ↗
                    </button>
                  </header>
                  <div className="real-player-body">
                    <div
                      className={"real-vinyl-disc " + (isVinylPlaying ? "playing" : "")}
                      onClick={() => setIsVinylPlaying(!isVinylPlaying)}
                      title="点击播放 / 暂停"
                    >
                      <div className="real-vinyl-needle" />
                      <div className="real-vinyl-core" />
                    </div>
                    <div className="real-player-info">
                      <strong className="real-song-title">塞壬唱片 · 点击播放</strong>
                      <span className="real-song-sub">明日方舟音乐库</span>
                      <div className="real-seek-row">
                        <span>{isVinylPlaying ? "01:18" : "0:00"}</span>
                        <div className="real-seek-track">
                          <div className="real-seek-fill" style={{ width: isVinylPlaying ? "45%" : "6%" }} />
                          <span className="real-seek-Knob" style={{ left: isVinylPlaying ? "45%" : "6%" }} />
                        </div>
                        <span>03:24</span>
                      </div>
                      <div className="real-player-btns">
                        <button type="button" className="real-m-btn">⏮</button>
                        <button
                          type="button"
                          className="real-m-btn play"
                          onClick={() => setIsVinylPlaying(!isVinylPlaying)}
                        >
                          {isVinylPlaying ? "⏸" : "▶"}
                        </button>
                        <button type="button" className="real-m-btn">⏭</button>
                        <button type="button" className="real-m-btn">♡</button>
                        <button type="button" className="real-m-btn" style={{ color: "#3b82f6" }}>🔁</button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* 第二排：双栏大底座 (左侧常用网站背包网格 + 右侧 AI HOT 资讯) */}
              <div className="real-launcher-bottom-grid">
                {/* 左侧：常用网站与 2x2 大文件夹卡片 (FavoriteSites.vue) */}
                <section className="real-glass-card real-sites-panel">
                  <header className="real-sites-header">
                    <div className="real-sites-switch">
                      <button
                        type="button"
                        className={sitesView === "sites" ? "active" : ""}
                        onClick={() => setSitesView("sites")}
                      >常用网站</button>
                      <button
                        type="button"
                        className={sitesView === "bookmarks" ? "active" : ""}
                        onClick={() => setSitesView("bookmarks")}
                      >书签</button>
                    </div>

                    <div className="real-page-tabs">
                      {sitePageTabs.map(tab => (
                        <button
                          key={tab}
                          type="button"
                          className={"real-page-tab " + (activeSitePage === tab ? "active" : "")}
                          onClick={() => {
                            setSitesView("sites");
                            setActiveSitePage(tab);
                          }}
                        >
                          {tab}
                        </button>
                      ))}
                      <button type="button" className="real-page-add">+</button>
                    </div>
                  </header>

                  {sitesView === "sites" ? (
                    <div className="real-backpack-grid">
                      {currentTiles.map(tile => {
                        if (tile.type === "folder-large") {
                          return (
                            <div key={tile.id} className="real-tile-folder-large">
                              <div className="real-folder-large-box">
                                {tile.subIcons?.map((ic, i) => (
                                  <span
                                    key={i}
                                    className="real-mini-icon"
                                    style={{ background: ic.bg, color: ic.color || "#0f172a" }}
                                  >
                                    {ic.text}
                                  </span>
                                ))}
                              </div>
                              <span className="real-tile-label">{tile.title}</span>
                            </div>
                          );
                        }
                        if (tile.type === "folder-small") {
                          return (
                            <div key={tile.id} className="real-tile-item">
                              <div className="real-folder-small-box">
                                {tile.subIcons?.slice(0, 4).map((ic, i) => (
                                  <span
                                    key={i}
                                    className="real-micro-icon"
                                    style={{ background: ic.bg, color: ic.color || "#0f172a" }}
                                  >
                                    {ic.text}
                                  </span>
                                ))}
                              </div>
                              <span className="real-tile-label">{tile.title}</span>
                            </div>
                          );
                        }
                        return (
                          <div key={tile.id} className="real-tile-item">
                            <div
                              className="real-link-favicon"
                              style={{ background: tile.iconBg || "#ffffff", color: tile.iconColor || "#0f172a" }}
                            >
                              <span>{tile.iconText}</span>
                            </div>
                            <span className="real-tile-label">{tile.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="real-bookmarks-placeholder">
                      <div className="real-bm-grid">
                        {topBookmarkFolders.map((f, i) => (
                          <div key={i} className="real-bm-card">
                            <span className="real-bm-folder-ico">📂</span>
                            <div>
                              <strong>{f}</strong>
                              <small>{12 + i * 5} 个书签项 · Worker 拼音秒搜</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                {/* 右侧：AI HOT 资讯卡片 (LauncherAiHotCard.vue) */}
                <section className="real-glass-card real-aihot-panel">
                  <header className="real-card-head">
                    <span className="real-bar cyan" />
                    <h3>AI HOT 资讯</h3>
                    <span className="real-grow" />
                    <button
                      type="button"
                      className="real-head-pill-btn"
                      onClick={() => setAihotIdx(aihotIdx + 1)}
                    >
                      换一批 ↻
                    </button>
                    <button
                      type="button"
                      className="real-head-pill-btn"
                      onClick={() => handleDockClick("aihot")}
                    >
                      热榜 ↗
                    </button>
                  </header>

                  <div className="real-aihot-body">
                    <div
                      className="real-aihot-featured-card"
                      onClick={() => handleDockClick("aihot")}
                      title="点击打开 AI HOT 沉浸式阅读工作台"
                    >
                      <span className="real-aihot-rank">{currentAihot.rank}</span>
                      <div className="real-aihot-main">
                        <h4>{currentAihot.title}</h4>
                        <p>{currentAihot.summary}</p>
                        <div className="real-aihot-meta">
                          <span className="real-aihot-tag">{currentAihot.tag}</span>
                          <span className="real-aihot-source">{currentAihot.source}</span>
                          <span className="real-aihot-time">{currentAihot.time}</span>
                        </div>
                      </div>
                    </div>

                    <div className="real-aihot-sublist">
                      {aihotPool.map((item, idx) => (
                        <div
                          key={item.rank}
                          className={"real-aihot-mini-row " + (idx === aihotIdx % aihotPool.length ? "active" : "")}
                          onClick={() => setAihotIdx(idx)}
                        >
                          <span className="mini-rank">{item.rank}</span>
                          <span className="mini-title">{item.title}</span>
                          <span className="mini-src">{item.source}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              {/* ================= 弹出的全屏工作区 / 独立窗口模拟层 ================= */}

              {/* 1. B站插件全屏工作区 (BilibiliWorkspace.vue) */}
              {activeWindow === "bili" && (
                <div className="sim-app-window sim-bili-window">
                  <div className="sim-win-header">
                    <div className="sim-win-title">
                      <span className="real-bar" style={{ background: "linear-gradient(180deg,#818cf8,#f472b6)" }} />
                      <Image src="/assets/bilibili.svg" alt="" width={16} height={16} />
                      <span>B站收藏夹</span>
                    </div>
                    <div className="sim-win-actions">
                      <span className="sim-win-badge">🔔 消息</span>
                      <span className="sim-win-badge">⚙ 关注分组管理</span>
                      <button
                        type="button"
                        className="sim-win-close-btn"
                        title="关闭窗口并熄灭绿点"
                        onClick={() => setActiveWindow(null)}
                      >✕</button>
                    </div>
                  </div>
                  <div className="sim-split-layout">
                    <div className="sim-pane-sidebar">
                      <div className="sim-sidebar-group">
                        <span className="sim-sidebar-label">⚡ 快捷频道</span>
                        <button
                          type="button"
                          className={"sim-channel-card " + (biliTab === "sub" ? "active" : "")}
                          onClick={() => setBiliTab("sub")}
                        >
                          <div>
                            <strong>🎬 订阅视频</strong>
                            <small>技术周刊 · AI字幕</small>
                          </div>
                          <span className="ch-badge pink">NEW</span>
                        </button>
                        <button
                          type="button"
                          className={"sim-channel-card " + (biliTab === "cache" ? "active" : "")}
                          onClick={() => setBiliTab("cache")}
                        >
                          <div>
                            <strong>💾 缓存视频</strong>
                            <small>本地文件夹 · 离线观看</small>
                          </div>
                          <span className="ch-badge blue">LOCAL</span>
                        </button>
                        <button
                          type="button"
                          className={"sim-channel-card " + (biliTab === "follow" ? "active" : "")}
                          onClick={() => setBiliTab("follow")}
                        >
                          <div>
                            <strong>📺 正在关注</strong>
                            <small>UP 主分组 · 最新投稿</small>
                          </div>
                          <span className="ch-badge green">FEED</span>
                        </button>
                        <button
                          type="button"
                          className={"sim-channel-card " + (biliTab === "rec" ? "active" : "")}
                          onClick={() => setBiliTab("rec")}
                        >
                          <div>
                            <strong>✨ 个性推荐</strong>
                            <small>猜你喜欢 · 每次刷新</small>
                          </div>
                          <span className="ch-badge purple">FOR YOU</span>
                        </button>
                        <button
                          type="button"
                          className={"sim-channel-card " + (biliTab === "radio" ? "active" : "")}
                          onClick={() => setBiliTab("radio")}
                        >
                          <div>
                            <strong>📻 B站电台</strong>
                            <small>连播系列 · 自由编排</small>
                          </div>
                          <span className="ch-badge amber">RADIO</span>
                        </button>
                      </div>

                      <div className="sim-sidebar-group">
                        <span className="sim-sidebar-label">📁 我创建的收藏夹</span>
                        <button type="button" className="sim-sidebar-item">
                          <span>默认收藏夹</span>
                          <span className="sim-item-pill">36</span>
                        </button>
                        <button type="button" className="sim-sidebar-item">
                          <span>前端与架构</span>
                          <span className="sim-item-pill">18</span>
                        </button>
                      </div>
                    </div>

                    <div className="sim-pane-content">
                      <div className="sim-tape-player">
                        <div className="sim-tape-left">
                          <span className="sim-tape-tag">CASSETTE TAPE</span>
                          <span>📼 B站电台 DASH 纯音频流 (~3MB) · 支持拖拽视频化为磁带连播</span>
                        </div>
                        <span className="sim-tape-status">● 智能切源就绪</span>
                      </div>

                      <div className="sim-video-grid">
                        <div className="sim-video-card">
                          <div className="sim-video-thumb v1">
                            <span className="sim-video-duration">18:42</span>
                          </div>
                          <h5 className="sim-video-title">【前端实操】从零搭建高性能 MV3 浏览器扩展</h5>
                          <div className="sim-video-meta">
                            <span>开发者周刊</span>
                            <span>24.6万 · AI字幕</span>
                          </div>
                        </div>

                        <div className="sim-video-card">
                          <div className="sim-video-thumb v2">
                            <span className="sim-video-duration">32:10</span>
                          </div>
                          <h5 className="sim-video-title">【架构演进】Chromium 扩展组件化与本地存储实践</h5>
                          <div className="sim-video-meta">
                            <span>前端架构师</span>
                            <span>8.9万 · 收藏夹</span>
                          </div>
                        </div>

                        <div className="sim-video-card">
                          <div className="sim-video-thumb v3">
                            <span className="sim-video-duration">01:45:00</span>
                          </div>
                          <h5 className="sim-video-title">【塞壬唱片】孤星 Lonetrail 太空歌剧纯享工作电台</h5>
                          <div className="sim-video-meta">
                            <span>塞壬唱片-MSR</span>
                            <span>102.4万 · 电台</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. GitHub 插件全屏工作区 + v1.0.5 Topic 看板 (GitHubWorkspaceCard.vue) */}
              {activeWindow === "github" && (
                <div className="sim-app-window sim-github-window">
                  <div className="sim-win-header">
                    <div className="sim-win-title">
                      <span className="real-bar" style={{ background: "linear-gradient(180deg,#22c55e,#06b6d4)" }} />
                      <Image src="/assets/nav-github.svg" alt="" width={16} height={16} />
                      <span>GitHub 工作区</span>
                    </div>
                    <div className="sim-win-actions">
                      <span className="sim-win-badge">v1.0.5 Topic 看板 · 点击卡片右侧按钮可测试移动</span>
                      <button
                        type="button"
                        className="sim-win-close-btn"
                        title="关闭窗口并熄灭绿点"
                        onClick={() => setActiveWindow(null)}
                      >✕</button>
                    </div>
                  </div>
                  <div className="sim-split-layout">
                    <div className="sim-pane-sidebar">
                      <div className="sim-sidebar-group">
                        <span className="sim-sidebar-label">⚡ 快捷频道</span>
                        <button
                          type="button"
                          className={"sim-channel-card " + (ghTab === "stars" ? "active" : "")}
                          onClick={() => setGhTab("stars")}
                        >
                          <div>
                            <strong>⭐ Star 收藏</strong>
                            <small>星标项目 · 文件夹管理</small>
                          </div>
                          <span className="ch-badge amber">STAR</span>
                        </button>
                        <button
                          type="button"
                          className={"sim-channel-card " + (ghTab === "trending" ? "active" : "")}
                          onClick={() => setGhTab("trending")}
                        >
                          <div>
                            <strong>🔥 趋势榜单</strong>
                            <small>开源风向标 · 今日热榜</small>
                          </div>
                          <span className="ch-badge pink">HOT</span>
                        </button>
                        <button
                          type="button"
                          className={"sim-channel-card " + (ghTab === "awesome" ? "active" : "")}
                          onClick={() => setGhTab("awesome")}
                        >
                          <div>
                            <strong>🌟 资源专区</strong>
                            <small>神级清单 · 全球精选</small>
                          </div>
                          <span className="ch-badge purple">AWESOME</span>
                        </button>
                        <button
                          type="button"
                          className={"sim-channel-card " + (ghTab === "repos" ? "active" : "")}
                          onClick={() => setGhTab("repos")}
                        >
                          <div>
                            <strong>📦 我的仓库</strong>
                            <small>个人项目 · Topic 看板</small>
                          </div>
                          <span className="ch-badge blue">REPOS</span>
                        </button>
                      </div>
                    </div>

                    <div className="sim-pane-content">
                      <div className="sim-gh-kanban-head">
                        <strong>📦 我的仓库 · Topic 看板（v1.0.5 新增）</strong>
                        <span>支持卡片拖拽、滚轮横移、右键「📁 移动到分组」并自动 PUT 同步 GitHub 远端 Topics</span>
                      </div>

                      <div className="sim-gh-kanban-track">
                        {[
                          { id: "default", title: "默认板块 (未分类)", dot: "#94a3b8" },
                          { id: "tools", title: "#tools", dot: "#0284c7" },
                          { id: "vue3", title: "#vue3", dot: "#0284c7" },
                        ].map(col => {
                          const list = kanbanRepos.filter(r => r.topic === col.id);
                          return (
                            <div key={col.id} className="sim-gh-kanban-col">
                              <div className="sim-gh-col-title">
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                  <i style={{ width: 7, height: 7, borderRadius: "50%", background: col.dot }} />
                                  {col.title}
                                </span>
                                <span className="sim-item-pill">{list.length}</span>
                              </div>

                              {list.map(repo => (
                                <div key={repo.id} className="sim-gh-card">
                                  <div className="sim-gh-card-top">
                                    <span className="sim-gh-card-name">{repo.name}</span>
                                    {col.id !== "tools" ? (
                                      <button
                                        type="button"
                                        className="sim-gh-move-btn"
                                        title="模拟移入 #tools 并同步 GitHub"
                                        onClick={() => moveRepoTopic(repo.id, "tools")}
                                      >→ #tools</button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="sim-gh-move-btn"
                                        title="模拟移入 #vue3 并同步 GitHub"
                                        onClick={() => moveRepoTopic(repo.id, "vue3")}
                                      >→ #vue3</button>
                                    )}
                                  </div>
                                  <p className="sim-gh-card-desc">{repo.desc}</p>
                                  {col.id !== "default" && (
                                    <div className="sim-gh-card-topics">
                                      <span className="sim-gh-topic-tag">
                                        #{col.id}
                                        <b
                                          onClick={() => moveRepoTopic(repo.id, "default")}
                                          title="点击移除 Topic 回到默认板块"
                                          style={{ cursor: "pointer", marginLeft: 4 }}
                                        >×</b>
                                      </span>
                                    </div>
                                  )}
                                  <div className="sim-gh-card-footer">
                                    <span>● {repo.lang}</span>
                                    <span>⭐ {repo.stars}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}

                        <div className="sim-gh-kanban-col sim-gh-col-new">
                          <span>＋ 新建 Topic 板块</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Todoist 任务工作区 (TodoistWorkspace.vue) */}
              {activeWindow === "todoist" && (
                <div className="sim-app-window sim-todoist-window">
                  <div className="sim-win-header">
                    <div className="sim-win-title">
                      <Image src="/assets/nav-todoist.svg" alt="" width={16} height={16} />
                      <span>Todoist 看板 · 离线 0ms 直出与 GitHub 任务分层</span>
                    </div>
                    <div className="sim-win-actions">
                      <span className="sim-win-badge">点击圆圈可直接完成任务</span>
                      <button
                        type="button"
                        className="sim-win-close-btn"
                        title="关闭窗口并熄灭绿点"
                        onClick={() => setActiveWindow(null)}
                      >✕</button>
                    </div>
                  </div>

                  <div className="sim-win-body">
                    <div className="sim-todoist-col">
                      <div className="sim-col-header">
                        <strong>github 任务区</strong>
                        <span className="sim-col-tag">按关联仓库分层排版</span>
                      </div>

                      <div className="sim-repo-layer">
                        <div
                          className="sim-repo-header"
                          onClick={() => setActiveRepoGroup(activeRepoGroup === "WebWorkspace" ? null : "WebWorkspace")}
                        >
                          <span className="repo-mark">🐙</span>
                          <strong className="repo-name">WebWorkspace</strong>
                          <span className="repo-counter">2 条任务</span>
                          <span className="repo-arrow">{activeRepoGroup === "WebWorkspace" ? "▸" : "▾"}</span>
                        </div>
                        {activeRepoGroup !== "WebWorkspace" && (
                          <div className="sim-task-cards-list">
                            {tasks.filter(t => t.repo === "WebWorkspace").map(t => (
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

              {/* 4. AI Hot / 模型价格 窗口 */}
              {activeWindow === "aihot" && (
                <div className="sim-app-window sim-todoist-window">
                  <div className="sim-win-header">
                    <div className="sim-win-title">
                      <Image src="/assets/nav-aihot.svg" alt="" width={16} height={16} />
                      <span>AI HOT 每日精选热榜 · 沉浸式正文提取阅读</span>
                    </div>
                    <button type="button" className="sim-win-close-btn" onClick={() => setActiveWindow(null)}>✕</button>
                  </div>
                  <div className="sim-win-body">
                    {aihotPool.map(item => (
                      <div key={item.rank} className="sim-notif-item" style={{ marginBottom: 8 }}>
                        <div className="sim-notif-meta">
                          <strong>#{item.rank} · {item.tag}</strong>
                          <span>{item.source} · {item.time}</span>
                        </div>
                        <div className="sim-notif-title">{item.title}</div>
                        <div className="sim-notif-desc">{item.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. 网易云与塞壬唱片音乐窗口 */}
              {activeWindow === "music" && (
                <div className="sim-app-window sim-music-window">
                  <div className="sim-win-header">
                    <div className="sim-win-title">
                      <Image src="/assets/netease.svg" alt="" width={16} height={16} />
                      <span>网易云音乐 · 官网会话直连 & 塞壬唱片库</span>
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
                      <strong>塞壬唱片 · 孤星 Lonetrail OST</strong>
                      <p>官网安全会话直连 · 无需本地中间代理节点</p>
                      <div className="sim-music-bar">
                        <span className="bar-fill" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= 底部 1:1 复刻 MacDock 快捷栏 (MacDock.vue) ================= */}
              <div className="real-mac-dock" role="toolbar" aria-label="快捷应用栏">
                {/* 左侧：全屏插件卡片组 (B站、YouTube、GitHub、AI Hot) */}
                <button
                  type="button"
                  className={"dock-btn " + (activeWindow === "bili" ? "active" : "")}
                  title="b站插件 (点击体验)"
                  onClick={() => handleDockClick("bili")}
                >
                  <Image src="/assets/bilibili.svg" alt="B站" width={24} height={24} />
                  {activeWindow === "bili" && <span className="dock-active-dot" />}
                </button>
                <button
                  type="button"
                  className="dock-btn"
                  title="YouTube (封藏中)"
                  onClick={() => handleDockClick("bili")}
                >
                  <Image src="/assets/nav-youtube.svg" alt="YouTube" width={24} height={24} />
                </button>
                <button
                  type="button"
                  className={"dock-btn " + (activeWindow === "github" ? "active" : "")}
                  title="github插件 · 我的仓库 Topic 看板 (点击体验)"
                  onClick={() => handleDockClick("github")}
                >
                  <Image src="/assets/nav-github.svg" alt="GitHub" width={24} height={24} />
                  {activeWindow === "github" && <span className="dock-active-dot" />}
                </button>
                <button
                  type="button"
                  className={"dock-btn " + (activeWindow === "aihot" ? "active" : "")}
                  title="ai hot插件 (点击体验)"
                  onClick={() => handleDockClick("aihot")}
                >
                  <Image src="/assets/nav-aihot.svg" alt="AI Hot" width={24} height={24} />
                  {activeWindow === "aihot" && <span className="dock-active-dot" />}
                </button>

                <div className="dock-divider" />

                {/* 中间：常用主页 (nav-home.svg) */}
                <button
                  type="button"
                  className={"dock-btn " + (activeWindow === null ? "active" : "")}
                  title="常用主页"
                  onClick={() => handleDockClick("home")}
                >
                  <Image src="/assets/nav-home.svg" alt="Home" width={24} height={24} />
                </button>

                <div className="dock-divider" />

                {/* 右侧：工具模块组 (Todoist、网易云、商店 🧩) */}
                <button
                  type="button"
                  className={"dock-btn " + (activeWindow === "todoist" ? "active" : "")}
                  title="todoist (点击体验)"
                  onClick={() => handleDockClick("todoist")}
                >
                  <Image src="/assets/nav-todoist.svg" alt="Todoist" width={24} height={24} />
                  {activeWindow === "todoist" && <span className="dock-active-dot" />}
                </button>
                <button
                  type="button"
                  className={"dock-btn " + (activeWindow === "music" ? "active" : "")}
                  title="网易云模块 (点击体验)"
                  onClick={() => handleDockClick("music")}
                >
                  <Image src="/assets/netease.svg" alt="Music" width={24} height={24} />
                  {activeWindow === "music" && <span className="dock-active-dot" />}
                </button>
                <button
                  type="button"
                  className="dock-btn"
                  title="商店 · 模块与全屏插件管理"
                  onClick={() => handleDockClick("github")}
                >
                  <span style={{ fontSize: 19 }}>🧩</span>
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
              <h3>多工作区与 2x2 大文件夹背包网格</h3>
              <p>支持创建多个专属工作区（默认、工作台、开发、设计、阅读等），2x2 大文件夹支持 9 宫格直达与深层嵌套，拖拽换位丝滑跟手。</p>
              <div className="bento-visual sites-preview">
                <span className="chip sage">常用平台 2x2</span>
                <span className="chip rose">常用AI 2x2</span>
                <span className="chip sand">Worker 书签秒搜</span>
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
              <h3>GitHub 资源专区与 Topic 看板</h3>
              <p>整理 Star 仓库与个人项目；全新上线「我的仓库 · Topic 看板」，支持卡片双向拖拽与 GitHub Topics 远端秒级同步，README 舒心畅读。</p>
            </article>

            {/* 卡片 5: 音乐陪伴 */}
            <article className="bento-card">
              <div className="bento-badge">05 · 旋律与白噪</div>
              <h3>顶栏滚动立方体与黑胶唱片</h3>
              <p>顶栏 3D 滚动立方体实时呈现歌词与状态；网易云通过同一浏览器官网会话直连，配合塞壬唱片与 B站 DASH 纯音频电台，轻巧纯净。</p>
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
              <p>在 GitHub 发行页面下载最新的 <code>tab-project-v1.0.5-extension.zip</code>，解压到电脑的固定目录。</p>
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
                <span>下载 1.0.5 正式版</span>
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

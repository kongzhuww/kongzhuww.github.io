"use client";

import { useState } from "react";
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

export default function Home() {
  const [theme, setTheme] = useState<ThemeId>("light");

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

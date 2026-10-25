"use client";

import { useState } from "react";

const REPO = "https://github.com/kongzhuww/tab-project-next";
const themes = [{ id: "light", label: "Light", note: "干净明亮，把注意力留给内容。" }, { id: "lonetrail", label: "Lonetrail", note: "温暖纸面，让日常慢一点。" }, { id: "dark", label: "Dark", note: "低亮度，在夜里也从容。" }] as const;
const spaces = ["常用网站", "todoist", "音乐"] as const;
const features = [
  { number: "01", icon: "▦", title: "常用的东西，放在顺手的位置", text: "常用网站与书签集中整理，支持文件夹、拖动排序与多工作区。不必每次都从一长串收藏里重新寻找。", tag: "常用网站 / 书签" },
  { number: "02", icon: "⌕", title: "从一个搜索栏出发", text: "连接网页、B站、GitHub 等搜索入口，也能优先检索本地书签和常用网站。少一点跳转，多一点直接。", tag: "搜索栏" },
  { number: "03", icon: "▷", title: "收藏，不只是存起来", text: "用B站插件整理收藏夹、查看订阅与字幕；用github插件分类、搜索 Star 仓库，继续阅读值得留下的内容。", tag: "B站插件 / github插件" },
  { number: "04", icon: "✓", title: "给今天留一点秩序", text: "在 todoist 中查看任务、日历和收件箱，让要做的事情与每天打开的页面待在一起。需要配置 Todoist Token。", tag: "todoist" },
  { number: "05", icon: "♫", title: "让音乐陪着日常", text: "在播放器、网易云模块与塞壬唱片模块之间选择。网易云通过同一浏览器的官网会话连接，实际播放受音源权限限制。", tag: "播放器 / 音乐" },
  { number: "06", icon: "◐", title: "按自己的习惯组合", text: "在商店中选择所需模块，用 Light、Lonetrail、Dark 调整界面。海狸聊天室为默认关闭的实验模块，需要自托管服务。", tag: "主题 / 商店" },
];

export default function Home() {
  const [theme, setTheme] = useState<(typeof themes)[number]["id"]>("light");
  const [space, setSpace] = useState<(typeof spaces)[number]>("常用网站");
  const [done, setDone] = useState(false);

  return (
    <div className="landing" data-theme={theme}>
      <a className="skip-link" href="#main">跳到正文</a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="tab-project-next 首页"><span className="brand-symbol" aria-hidden="true">t.</span><span>tab-project<span className="brand-next"> / next</span></span></a>
        <nav aria-label="主导航"><a href="#features">功能</a><a href="#appearance">外观</a><a href="#install">安装</a></nav>
        <a className="repo-link" href={REPO} target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      </header>

      <main id="main">
        <section className="hero container">
          <div className="hero-copy">
            <p className="eyebrow"><span className="status-dot" /> 开源 · 桌面浏览器新标签页</p>
            <h1>打开新一页，<br />回到<span className="accent-word">你的日常。</span></h1>
            <p className="hero-description">常用的网站，没听完的歌，准备开始的事。<br className="desktop-break" />让它们在一个新标签页里，各得其所。</p>
            <div className="actions"><a className="button primary" href="#install">开始使用 <span aria-hidden="true">↗</span></a><a className="button secondary" href={REPO} target="_blank" rel="noopener noreferrer">查看源码 <span aria-hidden="true">↗</span></a></div>
            <p className="compatibility">适用于 Microsoft Edge / Google Chrome <span>· Manifest V3</span></p>
          </div>
          <div className="hero-aside"><span className="aside-index">A NEW TAB.<br />A LITTLE MORE YOU.</span><p>不是再多一个入口。<br />是把已经喜欢的东西，<br />放得更近一点。</p><a href="#preview">看看它的样子 <span aria-hidden="true">↓</span></a></div>
        </section>

        <section className="preview-section container" id="preview" aria-label="交互式界面示意">
          <div className="browser-frame">
            <div className="browser-chrome"><span className="window-dots" aria-hidden="true"><i /><i /><i /></span><span className="address">tab-project-next / 新标签页</span><span className="demo-pill">演示数据</span></div>
            <div className="demo-desktop">
              <div className="demo-topbar"><span className="demo-profile"><span className="avatar">T</span> 我的空间</span><span>书签 <span aria-hidden="true">·</span> 设置</span></div>
              <div className="demo-greeting"><p>给今天，一个舒服的开始。</p><span className="demo-clock">09:41</span><p>慢慢来，想做的事就在眼前。</p></div>
              <div className="demo-search"><span aria-hidden="true">⌕</span><span>搜索书签、常用网站，或探索更多</span><kbd>⌘ K</kbd></div>
              <div className="workspace-tabs" role="tablist" aria-label="演示内容">{spaces.map(item => <button key={item} id={`tab-${item}`} role="tab" aria-selected={space === item} aria-controls="demo-panel" onClick={() => setSpace(item)}>{item}</button>)}</div>
              <div className="demo-content" id="demo-panel" role="tabpanel" aria-labelledby={`tab-${space}`} tabIndex={0}>
                {space === "常用网站" && <div className="site-grid">{[{ mark: "GH", name: "GitHub", tone: "sage" }, { mark: "B", name: "B站", tone: "rose" }, { mark: "N", name: "Notion", tone: "sand" }, { mark: "F", name: "Figma", tone: "lavender" }, { mark: "♪", name: "网易云音乐", tone: "rose" }, { mark: "＋", name: "添加网站", tone: "neutral" }].map(site => <div className="site-tile" key={site.name}><span className={`site-icon ${site.tone}`}>{site.mark}</span><span>{site.name}</span></div>)}</div>}
                {space === "todoist" && <div className="task-demo"><div><span className="small-label">今天 / 演示任务</span><h3>留一点时间，给想做的事。</h3></div><button className={`demo-task ${done ? "is-done" : ""}`} onClick={() => setDone(!done)} aria-pressed={done}><span className="task-check">{done ? "✓" : ""}</span><span>整理今天的阅读清单</span><small>{done ? "已完成" : "点击试试"}</small></button><p>仅切换此页的演示状态，不连接真实 Todoist 账号。</p></div>}
                {space === "音乐" && <div className="music-demo"><div className="record" aria-hidden="true">♫</div><div><span className="small-label">音乐时光 / 界面示意</span><h3>给日常配一段旋律</h3><p>网易云 · 塞壬唱片 · 播放器</p><span className="music-note">此演示不播放音频</span></div></div>}
              </div>
              <div className="demo-dock" aria-hidden="true"><span>⌂</span><span>✓</span><span>♫</span><span>▷</span><span>GH</span><span>▦</span></div>
            </div>
          </div>
          <div className="preview-caption"><span>01 / 日常，从这里展开</span><span>可点击切换内容 · 非实机截图</span></div>
        </section>

        <section className="platform-strip container" aria-label="项目技术"><span>你的浏览器。你的节奏。</span><div><span>Vue 3</span><span>TypeScript</span><span>Manifest V3</span><span>开源可定制</span></div></section>

        <section className="features-section container section-space" id="features">
          <div className="section-heading"><div><p className="eyebrow">MADE FOR YOUR EVERYDAY</p><h2>少一点来回，<br />多一点顺手。</h2></div><p>不必改变你的习惯。<br />把常用的工具，整理成自己的新标签页。</p></div>
          <div className="feature-grid">{features.map(feature => <article className="feature" key={feature.number}><div className="feature-top"><span className="feature-icon" aria-hidden="true">{feature.icon}</span><span className="feature-number">{feature.number}</span></div><h3>{feature.title}</h3><p>{feature.text}</p><span className="feature-tag">{feature.tag}</span></article>)}</div>
        </section>

        <section className="appearance-section section-space" id="appearance"><div className="container appearance-inner"><div><p className="eyebrow">A SPACE THAT FEELS LIKE YOU</p><h2>今天，想用哪一种心情？</h2><p>三种外观，同一个熟悉的空间。<br />选择主题，看看这个介绍页的变化。</p></div><div className="theme-picker"><div className="theme-options" role="group" aria-label="选择网站演示主题">{themes.map(item => <button key={item.id} className={`theme-option ${theme === item.id ? "selected" : ""}`} aria-pressed={theme === item.id} onClick={() => setTheme(item.id)}><span className={`theme-swatch swatch-${item.id}`} aria-hidden="true"><i /><i /><i /></span><span>{item.label}</span></button>)}</div><p className="theme-note" aria-live="polite">{themes.find(item => item.id === theme)?.note}</p></div></div></section>

        <section className="install-section container section-space" id="install"><div className="section-heading"><div><p className="eyebrow">MAKE YOURSELF AT HOME</p><h2>从下一个新标签页开始。</h2></div><a className="text-link" href={`${REPO}#安装`} target="_blank" rel="noopener noreferrer">完整安装说明 ↗</a></div><div className="install-grid"><article className="install-step"><span className="step-number">01</span><h3>获取扩展</h3><p>前往新仓库的发行列表。有扩展 ZIP 附件时，下载并解压到固定目录；若暂无附件，请按 README 从源码构建。</p><a className="text-link" href={`${REPO}/releases`} target="_blank" rel="noopener noreferrer">查看发行列表 ↗</a></article><article className="install-step"><span className="step-number">02</span><h3>加载到浏览器</h3><p>手动打开 <code>edge://extensions</code> 或 <code>chrome://extensions</code>，开启开发者模式，选择“加载解压缩的扩展”。</p></article><article className="install-step"><span className="step-number">03</span><h3>布置你的空间</h3><p>选择包含 <code>manifest.json</code> 的扩展目录。打开新标签页，添加常用网站，再按需连接各模块的账号。</p></article></div><aside className="install-notice"><strong>先留好你的旧空间。</strong><p>新仓库不会自动迁移旧扩展数据；安装前请先备份并保留旧安装。GitHub 的 Source code 压缩包不是已构建的扩展包。</p></aside></section>

        <section className="faq-section container section-space"><div><p className="eyebrow">GOOD TO KNOW</p><h2>开始之前，<br />说清楚几件事。</h2></div><div className="faq-list"><details><summary>所有功能都可以直接使用吗？</summary><p>基础常用网站与书签在浏览器本地运行。B站部分能力需要登录；GitHub Token 按功能选配；todoist 需要 Token。网易云需先在同一浏览器官网登录，再连接官网账户。在线能力受对应平台接口与权限影响。</p></details><details><summary>需要安装额外的桌面程序吗？</summary><p>当前项目只维护桌面 Chromium 浏览器扩展，不需要 Native Host 或本机 EXE。独立 Android 应用与桌宠已移除；海狸聊天室等自托管模块仍需要各自服务。</p></details><details><summary>数据都只保存在本机吗？</summary><p>不是。配置和部分缓存使用浏览器存储，但调用在线 API 会向对应服务发送请求。聊天室内容由服主服务器保存，不提供端到端加密。浏览器本地存储也不等于应用级加密。</p></details><details><summary>这里展示的就是当前发行版吗？</summary><p>上方是使用虚构数据制作的界面示意，不是扩展实机截图。功能说明参考本地 tab-project-next 源码与 README；源码、发布附件及自托管服务的版本可能不同，请以目标版本说明为准。</p></details></div></section>

        <section className="closing container"><span className="brand-symbol" aria-hidden="true">t.</span><h2>新的一页，留给自己。</h2><p>tab-project-next · 一个持续生长的开源新标签页项目</p><a className="button primary" href={REPO} target="_blank" rel="noopener noreferrer">去 GitHub 看看 <span aria-hidden="true">↗</span></a></section>
      </main>
      <footer className="site-footer container"><a className="brand" href="#">tab-project<span className="brand-next"> / next</span></a><span>由 kongzhuww 构建 · 保持好奇，保持自己的节奏。</span><div><a href={REPO} target="_blank" rel="noopener noreferrer">源码 ↗</a><a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer">反馈 ↗</a></div></footer>
    </div>
  );
}

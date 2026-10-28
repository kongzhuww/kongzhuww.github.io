# tab-project-next 介绍网站

[English](README_en.md) | **简体中文**

基于 Next.js 16、React 19 与 TypeScript 的静态介绍站，介绍 [kongzhuww/tab-project-next](https://github.com/kongzhuww/tab-project-next)。

- 网站仓库：`kongzhuww/tab-project-website`
- 本地目录：`D:\default save place\GitHub\tab-project-website`
- 正式域名配置：`https://logicweaver.me/`
- 首页：功能介绍、Light / Lonetrail / Dark 演示、安装和 FAQ。
- 隐私政策：`/privacy`（静态导出为 `out/privacy.html`），首页页脚提供入口；部署及公开访问验证前不能作为已上线链接提交商店。
- 政策依据和发布前核对清单：`docs/PRIVACY_REVIEW.md`。

旧版 AI RSS 日报页面、报告 JSON 和旧 IoT 模拟脚本已移除，不再维护 `/daily/` 或 `/reports/`。历史代码仍保留在 Git 提交中；本次不改外部 n8n 自动化、DNS 或远端服务。

## 内容边界

首页基于本地 tab-project-next README 和源码制作；不在构建时请求 GitHub，也不宣称某个发行附件已存在。发行入口使用 `/releases` 列表，无附件时按项目 README 从源码构建。

预览使用虚构数据，不是真实扩展截图。主题切换、内容切换和任务勾选只改变此网页内的演示状态，不操作扩展或真实账号，不播放音频。

默认明亮主题，主题色使用 CSS 变量。没有增加登录、数据库、API 或统计 SDK。不要将私密配置、Token、Cookie、个人截图放入 public。

## 本地开发与验证

```bash
npm run dev
npm run lint
npx --no-install tsc --noEmit
npm run build
```

打开终端显示的地址，通常为 `http://localhost:3000`。`output: "export"` 保持不变，静态构建输出在 `out/`，不使用 `next start` 预览静态导出。

主要文件：

```text
src/app/page.tsx          项目介绍与交互演示
src/app/globals.css       响应式样式与主题变量
src/app/layout.tsx        中文语言与默认元数据
src/app/privacy/page.tsx  扩展及网站隐私政策
src/app/privacy/privacy.module.css  政策页主题自适应样式
next.config.mjs          Next.js 静态导出配置
wrangler.toml            Cloudflare 静态资源和域名路由
```

## 部署

保持 Cloudflare Workers Static Assets 配置：

- Build command：`npm run build`
- Deploy command：`npx wrangler deploy`
- 静态资源：`out/`
- Worker：`project911`
- 域名路由：`logicweaver.me/*` 与 `www.logicweaver.me/*`

本地 Git 提交不会自动改变线上网站；只有明确授权后才推送或部署。

GitHub 仓库已由 `kongzhuww.github.io` 更名为 `tab-project-website`，旧 GitHub Pages 用户站地址可能失效；正式域名仍按 Cloudflare 配置管理。若 Cloudflare 自动构建连接了旧仓库，请在控制台核对并按需重新连接，不因改名擅自改动 Worker 名称、路由或 DNS。不读取 `.env` / `.env.local` 来制作介绍页。

## 维护说明

`CLAUDE.md` 含改版前的 RSS 首页操作记录；其中“保持 RSS 产品名和首页定位”、日报验收等描述已由本次用户要求取代。该文件原有未提交修改予以保留，不混入本次网站改版提交。后续以用户当前要求、本 README、AGENTS.md 及当前源码为准，不恢复已退役的日报、IoT、数据库或登录系统。

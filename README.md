# tab-project-next 介绍网站

基于 Next.js 16、React 19 与 TypeScript 的静态介绍站，介绍 [kongzhuww/tab-project-next](https://github.com/kongzhuww/tab-project-next)。

- 网站仓库：`kongzhuww/kongzhuww.github.io`
- 本地目录：`D:\default save place\GitHub\my-plugins-sites\kongzhuww.github.io`
- 正式域名配置：`https://logicweaver.me/`
- 首页：功能介绍、Light / Lonetrail / Dark 演示、安装和 FAQ。

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

本地 Git 提交不会自动改变线上网站；只有明确授权后才推送或部署。不读取 `.env` / `.env.local` 来制作介绍页。

## 维护说明

`CLAUDE.md` 含改版前的 RSS 首页操作记录；其中“保持 RSS 产品名和首页定位”、日报验收等描述已由本次用户要求取代。该文件原有未提交修改予以保留，不混入本次网站改版提交。后续以用户当前要求、本 README、AGENTS.md 及当前源码为准，不恢复已退役的日报、IoT、数据库或登录系统。

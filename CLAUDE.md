# LogicWeaver 网站 AI 操作手册

> 最后核对日期：2026-07-18
>
> 本文件用于指导后续 AI/Coding Agent 维护 LogicWeaver 网站。开始工作前必须先核对仓库现状，不要把本文中的"最后已知状态"当成永远不变的事实。

## 1. 用户与沟通方式

- 用户主要使用中文，不熟悉代码。
- 优先直接完成检查、修改、测试和部署，不要只给一大段教程让用户自己操作。
- 解释要简洁，重点说明：改了什么、是否验证通过、网站现在是否可访问。
- 涉及删除 Cloudflare 项目、DNS 记录、Git 历史、日报数据、远程仓库或其他不可逆操作时，必须先说明影响并征得确认。
- 不要要求用户在聊天中发送 API Key、密码、Cookie、Cloudflare Token 或私钥。

## 2. 网站基本信息

- 正式域名：`https://logicweaver.me/`
- `www` 域名：`https://www.logicweaver.me/`
- 本地项目：`D:\default save place\GitHub\kongzhuww.github.io`
- GitHub 仓库：`https://github.com/kongzhuww/kongzhuww.github.io`
- 默认分支：`main`
- Cloudflare Worker：`project911`
- 当前部署类型：Next.js 静态导出 + Cloudflare Workers Static Assets
- 操作系统：Windows，默认 Shell 为 PowerShell。
- 项目路径包含空格，所有命令都必须正确引用完整路径。

最后已知的正常基线提交：

- `7605441 Route custom domain to Cloudflare Worker`
- `0a97352 Configure Cloudflare static assets deploy`
- `1c732b5 Remove legacy dashboard backend`

开始工作时使用 `git log` 和 `git status` 再次确认，不要强行回退到这些提交。

## 3. 技术栈与架构

- Next.js `16.2.6`
- React `19.2.4`
- TypeScript
- Tailwind CSS `4`
- Wrangler `4.112.0` 或更新版本
- `next.config.mjs` 使用 `output: "export"`
- 构建产物目录：`out/`
- Cloudflare 从 `out/` 发布静态资源
- 页面在浏览器端读取 `/reports/index.json` 和日报 JSON
- 当前网站不需要数据库、登录系统或服务端 API

主要文件：

- `src/app/page.tsx`：首页和日报展示逻辑
- `src/app/globals.css`：全局样式
- `src/app/layout.tsx`：页面元数据、字体和根布局
- `public/reports/`：n8n 生成的日报 JSON
- `next.config.mjs`：Next.js 静态导出配置
- `wrangler.toml`：Cloudflare Worker、静态资源和域名路由配置
- `AGENTS.md`：项目内 Next.js Agent 规则
- `README.md`：项目和日报数据格式说明

项目内 `CLAUDE.md` 当前引用 `AGENTS.md`。修改 Next.js 代码前，应先阅读 `AGENTS.md`，并按要求查看 `node_modules/next/dist/docs/` 中与任务相关的 Next.js 16 文档。

## 4. 当前明确不需要的旧系统

以下内容是旧项目残留，已经删除。除非用户明确提出新需求，不要重新引入：

- Supabase
- Prisma
- NextAuth 或 GitHub 登录
- IoT devices API 和 dashboard
- GitHub pins/config/todos 后端接口
- Next.js API Routes
- Python Web 展示服务器
- 独立 systemd 网站服务

出现 `supabaseUrl is required` 时，通常表示旧 Supabase 代码被重新引入。不要通过伪造环境变量掩盖问题，应先检查并移除不需要的旧依赖或导入。

## 5. RSS 日报系统

最后已知的 n8n 工作流：

- 名称：`📰 RSS AI 日报生成器`
- ID：`e552a5f9-3bd6-4fbb-af45-1402a8a4a4a1`
- 计划时间：每天北京时间 `08:00`
- 最后已知状态：已导入但未激活。操作前必须去 n8n 核对，不能直接假设已经激活。
- RSS 源：
  - HuggingFace Blog
  - OpenAI News
  - Hacker News
  - Google AI Blog
- 摘要模型：DeepSeek，由 n8n/VPS 调用

架构原则：

- DeepSeek API Key 只能保存在 n8n Credentials、VPS 环境变量或其他服务端 Secret 中。
- 前端不得包含 DeepSeek、OpenAI、Cloudflare 或其他 API Key。
- 前端只读取静态 JSON，因此不需要数据库。
- n8n 生成 JSON 后，必须同步或提交到仓库的 `public/reports/`，然后重新构建部署。

日报文件：

- `public/reports/latest.json`：最新日报正文
- `public/reports/index.json`：日报列表及最新日报路径
- `public/reports/YYYY-MM-DD.json`：历史日报

`index.json` 的关键结构：

```json
{
  "latest": "/reports/latest.json",
  "reports": [
    {
      "date": "2026-07-18",
      "title": "AI RSS 日报",
      "path": "/reports/2026-07-18.json",
      "itemCount": 30
    }
  ]
}
```

日报正文的关键字段：

```json
{
  "title": "AI RSS 日报",
  "date": "2026-07-18",
  "generatedAt": "2026-07-18T08:00:00+08:00",
  "summary": "今日总览",
  "highlights": [],
  "trends": [],
  "sources": [],
  "items": []
}
```

每条 `items` 应包含：

- `title`
- `source`
- `url`
- `summary`
- 可选 `publishedAt`
- 可选 `tags`
- 可选 `importance`，推荐值为 `high`、`medium`、`low`

修改日报生成流程时必须保证：

- JSON 是有效 UTF-8。
- `index.json.latest` 指向存在的文件。
- 历史报告按日期倒序排列。
- 新日报不要覆盖或删除旧日报，除非用户明确要求清理。
- RSS 单个来源失败时，不应导致整份日报无法生成；应保留其他来源并记录失败来源。

## 6. Cloudflare 部署

当前 `wrangler.toml` 的关键配置：

```toml
name = "project911"
compatibility_date = "2026-07-18"

routes = [
  { pattern = "logicweaver.me/*", zone_name = "logicweaver.me" },
  { pattern = "www.logicweaver.me/*", zone_name = "logicweaver.me" },
]

[assets]
directory = "./out"
not_found_handling = "404-page"
```

重要说明：

- 域名已有 Cloudflare DNS 记录，因此使用 Worker Routes。
- 不要改成 `custom_domain = true`。该方式曾因现有 DNS 记录产生 `409 Conflict`。
- 不要添加 `WORKER_SELF_REFERENCE`。
- 当前静态网站不需要 Worker service binding、Images binding、数据库 binding 或其他资源绑定。
- Wrangler 输出的 `*.workers.dev` 是 Worker 默认或备用地址，不是正式网站域名。
- 正式访问地址始终优先验证 `https://logicweaver.me/`。
- 不要擅自删除域名 DNS 记录或更换 Worker 名称。

Cloudflare Git 部署设置应保持：

- Build command：`npm run build`
- Deploy command：`npx wrangler deploy`
- Root directory：仓库根目录

## 7. 标准操作流程

进入项目：

```powershell
Set-Location 'D:\default save place\GitHub\kongzhuww.github.io'
```

工作前检查：

```powershell
git status --short --branch
git log -5 --oneline
git remote -v
```

如果存在不是当前 AI 创建的未提交修改：

- 不要删除、覆盖、reset 或 checkout。
- 先阅读差异并与现有修改一起工作。
- 只有当这些修改使任务无法继续时才询问用户。

安装依赖：

```powershell
npm ci
```

本地开发：

```powershell
npm run dev
```

提交前最低验证：

```powershell
npm run lint
npm run build
npx wrangler deploy --dry-run
```

`wrangler deploy --dry-run` 应读取 `out/`，并显示：

```text
No bindings found.
```

正式部署：

```powershell
wrangler whoami
wrangler deploy
```

正式部署后验证：

```powershell
Invoke-WebRequest 'https://logicweaver.me/' -UseBasicParsing
Invoke-WebRequest 'https://www.logicweaver.me/' -UseBasicParsing
Invoke-WebRequest 'https://logicweaver.me/reports/index.json' -UseBasicParsing
Invoke-WebRequest 'https://logicweaver.me/reports/latest.json' -UseBasicParsing
```

以上地址应返回 HTTP `200`。

Git 提交与推送：

```powershell
git add -A
git commit -m "清晰描述本次修改"
git push
```

推送后再次执行：

```powershell
git status --short --branch
```

正常结果应为本地 `main` 与 `origin/main` 同步，并且没有未提交文件。

## 8. 密钥与安全规则

这个仓库曾经出现过 API Key 泄露，因此所有 AI 必须执行以下规则：

- 不得把真实 API Key、Token、密码、Cookie、私钥或数据库连接串写入代码、JSON、README、日志或 Git 提交。
- `.env`、`.env.local` 等环境文件已被 `.gitignore` 忽略，不要强行提交。
- `public/` 下的所有内容都会公开，绝对不能放 Secret。
- 浏览器可见的 `NEXT_PUBLIC_*` 不是 Secret，不能用于保存私密 Key。
- 前端不得直接调用需要私密 Key 的 AI API。
- 发现疑似泄露时，先提醒立即撤销/轮换密钥，再清理当前文件和 Git 历史。
- 仅从最新提交删除密钥是不够的，旧提交中的密钥仍可能被获取。
- 不要在终端输出完整 Token，也不要把 Secret 作为命令行参数。

建议的基础扫描：

```powershell
rg -n -i "api[_-]?key|secret|token|password|bearer|sk-[A-Za-z0-9]" . -g '!node_modules' -g '!.next' -g '!out' -g '!.git'
git grep -n -I -E "api[_-]?key|secret|token|password|bearer|sk-"
```

扫描结果必须人工判断，不要因为变量名中出现 `token` 就直接删除正常代码。

## 9. 前端修改规则

- 保持产品名 `LogicWeaver AI RSS Daily`。
- 网站主要面向快速阅读 AI 日报，设计应清晰、紧凑、适合扫描。
- 中文是主要界面语言。
- 不要做大型营销落地页、无意义动画、装饰性渐变球或嵌套卡片。
- 页面必须兼容手机和桌面，文字和按钮不能重叠或溢出。
- 保持日报 JSON 数据契约，不要为了改 UI 随意修改 n8n 输出格式。
- 新增 RSS 来源时，同时更新来源展示配置和容错逻辑。
- 外部文章链接应安全打开，避免破坏当前日报阅读状态。
- 不要为了一个小功能引入数据库、认证系统或大型状态管理库。
- 修改页面后至少检查首页加载、历史日报切换、外链、空数据和 JSON 读取失败状态。

## 10. 常见故障

### `supabaseUrl is required`

原因：旧 Supabase 客户端或 API 路由被重新引入。

处理：检查导入和路由，不要给这个纯静态网站重新配置 Supabase，除非用户明确需要数据库功能。

### `WORKER_SELF_REFERENCE ... Worker was not found`

原因：部署生成了无效 Worker service binding。

处理：

- 检查 `wrangler.toml` 是否仍是 `[assets] directory = "./out"`。
- 删除错误的 service binding 配置。
- 确认 dry-run 显示 `No bindings found.`

### Custom Domain 返回 `409 Conflict`

原因：域名已有 Cloudflare DNS 记录。

处理：使用当前 `zone_name` Worker Routes，不要使用 `custom_domain = true`，不要直接删除 DNS。

### 首页显示示例数据

检查：

- `public/reports/index.json` 是否存在且 JSON 有效。
- `index.json.latest` 指向的文件是否存在。
- 最新 JSON 是否已提交到 Git。
- `npm run build` 后 `out/reports/` 是否包含报告。
- 部署后 `/reports/index.json` 和 `/reports/latest.json` 是否返回 200。

### Git push 被拒绝

可能是 n8n 或其他自动化刚刚推送了新日报。先：

```powershell
git fetch origin main
git rebase origin/main
```

解决冲突时必须保留最新日报，不要覆盖 `public/reports/` 中由自动化生成的新内容。完成后重新构建、验证并推送。

## 11. 完成任务的标准

在告诉用户"完成"之前，至少确认：

- 修改内容与用户请求直接相关。
- 没有覆盖用户原有未提交修改。
- 没有新增或输出任何 Secret。
- `npm run lint` 通过。
- `npm run build` 通过。
- Cloudflare 配置改动经过 `wrangler deploy --dry-run`。
- 涉及部署时，正式域名和日报 JSON 返回 HTTP 200。
- 必要改动已经提交并推送。
- 最终向用户说明修改、验证结果和当前网站地址。

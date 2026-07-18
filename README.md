# LogicWeaver AI RSS Daily

这是一个 Next.js 前端，首页展示由 n8n 每天生成的 AI RSS 日报。旧的 GitHub 登录、IoT dashboard 和 Supabase 数据接口已移除，当前站点按静态日报展示部署。

## n8n 对接方式

推荐让 n8n 在每天 08:00 生成两个静态 JSON 文件，然后同步到网站的 `public/reports/` 目录。

- `public/reports/latest.json`: 最新日报正文
- `public/reports/index.json`: 历史日报列表和最新日报路径

前端只读取静态 JSON，不需要访问 DeepSeek、OneAPI 或任何服务端密钥。

## `latest.json` 格式

```json
{
  "title": "AI RSS 日报",
  "date": "2026-07-18",
  "generatedAt": "2026-07-18T08:00:00+08:00",
  "summary": "一句话总览",
  "highlights": ["重点 1", "重点 2"],
  "trends": ["模型更新", "开发者工具"],
  "sources": [
    { "name": "OpenAI News", "count": 3, "url": "https://openai.com/news" }
  ],
  "items": [
    {
      "title": "文章标题",
      "source": "OpenAI News",
      "url": "https://example.com/article",
      "summary": "AI 摘要",
      "tags": ["模型", "产品"],
      "importance": "high"
    }
  ]
}
```

## `index.json` 格式

```json
{
  "latest": "/reports/latest.json",
  "reports": [
    {
      "date": "2026-07-18",
      "title": "AI RSS 日报",
      "path": "/reports/latest.json",
      "itemCount": 12
    }
  ]
}
```

如果要保留历史日报，可以让 n8n 同时写入类似 `public/reports/2026-07-18.json` 的文件，然后把 `index.json` 里的 `reports` 数组追加对应记录，并把 `latest` 指向最新文件。

## 本地运行

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 构建

```bash
npm run build
```
## Cloudflare Worker 部署

这个仓库现在按静态导出部署：

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Static output: `out/`

`wrangler.toml` 指向 `out/` 静态资源目录，不配置 Worker service binding，也不需要 `WORKER_SELF_REFERENCE`。

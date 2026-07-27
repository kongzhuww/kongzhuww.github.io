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

## PID 串口调试助手 (`/pid`)

一个纯前端的 PID 整定工具：浏览器直接通过 **Web Serial API** 连接单片机，实时绘制阶跃响应波形，并用**你自己填写的 AI 接口**（Base URL + API Key，保存在本地浏览器，不经过任何服务器）自动分析一轮响应并给出 / 写入新的 Kp/Ki/Kd。

- 需要桌面版 **Chrome / Edge**，页面通过 HTTPS 或 `localhost` 打开。
- AI 走 OpenAI 兼容的 `/chat/completions`（OpenAI、DeepSeek、OneAPI、本地 Ollama 等均可）。

### 串口协议约定

上行（单片机 → 网页），每个控制周期一行，`\n` 结尾：

```
pid,<t_ms>,<setpoint>,<measured>,<output>[,<kp>,<ki>,<kd>]
例:  pid,1240,100.0,96.7,42.3
```

解析器还兼容：纯 CSV（按页面上“列顺序”映射）、`sp=100 pv=96.7 out=42.3` 键值对、以及 JSON `{"sp":100,"pv":96.7,"out":42.3}`。

下行（网页 → 单片机）命令模板（可在界面自定义，占位符会被替换）：

```
设定参数:  pid {kp} {ki} {kd}\n
设定目标:  sp {sp}\n
```

### 没有硬件？用模拟器测试

`pid_serial_sim.py` 是一个“假单片机”，在一个模拟一阶被控对象上跑 PID，讲同一套协议：

```bash
pip install pyserial
# Linux/macOS：先建一对虚拟串口
socat -d -d pty,raw,echo=0 pty,raw,echo=0
python pid_serial_sim.py /dev/pts/5     # 一端给模拟器
# 浏览器在 /pid 里连接另一端 /dev/pts/N
# Windows：装 com0com 后  python pid_serial_sim.py COM5
```

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

# 好友在听 (SMTC → Supabase)

网站顶栏「🎧 一起听」显示你和好友**正在听什么**，实时同步。音乐在**各自的官方客户端**里放（网易云 VIP 全曲库正常），网页只同步「正在播放」的元数据 —— 没有版权/取歌问题。

```
网易云 3.0+ 客户端 →(Windows SMTC)→ 本地 smtc-bridge.py
   → Supabase Edge Function (now-playing) → now_playing 表
   → 网站 Realtime 实时显示你 + 好友的「正在听」
```

前端组件 `src/app/ListenTogether.tsx` 已经在站上了，只要把下面三步做完就会亮起来。

## 1. 建表（Supabase → SQL Editor）

把 `schema.sql` 全部粘进去执行一次。会创建 `now_playing` 表、开只读 RLS、打开 Realtime。

## 2. 部署 Edge Function

把 `edge-function.ts` 作为 `now-playing` 函数部署，**关闭 JWT 校验**（我们自己用 `x-push-token` 鉴权）：

```bash
supabase functions deploy now-playing --no-verify-jwt
supabase secrets set NP_PUSH_TOKEN=<一串随机长字符串>
```

（`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 是平台自动注入的，不用管。）

## 3. 电脑上跑桥接程序（Windows）

前提：网易云 **3.0 以上**（老版本不报 SMTC）。

装依赖（推荐 PyWinRT 拆分包，有预编译 wheel、秒装，不用 C++ 编译器）：

```bash
pip install requests winrt-runtime winrt-Windows.Media.Control winrt-Windows.Storage.Streams winrt-Windows.Foundation
```

（老的 `pip install winsdk` 也行，但它常常要从源码编译、很慢，脚本两者都兼容。）

编辑 `smtc-bridge.py` 顶部 CONFIG：
- `PUSH_TOKEN` = 第 2 步设的 `NP_PUSH_TOKEN`
- `HANDLE` / `DISPLAY_NAME` = 你的 id 和显示名
- 其它默认即可

然后：

```bash
python smtc-bridge.py
```

放首歌，网页顶栏「🎧 一起听」就会显示。好友各自跑一份自己的（改 `HANDLE`/`DISPLAY_NAME`，用同一个 `PUSH_TOKEN`）就能互相看到。

## 开机自启 + 后台静默（可选）

不想每次手动开 PowerShell、也不想留个黑框，就让它开机自动在后台跑：

1. 把 `start-bridge.vbs` 放到 `smtcbridge.py` **同一个文件夹**。
2. `Win+R` → 输入 `shell:startup` → 回车，打开「启动」文件夹。
3. 把 `start-bridge.vbs` 的**快捷方式**拖进这个「启动」文件夹（右键 vbs → 创建快捷方式 → 把快捷方式剪切进去）。

之后每次开机登录，桥接会用 `pythonw` 在后台静默运行（无窗口）。运行情况可以看脚本旁边自动生成的 `smtc-bridge.log`。

> 若报找不到 `pythonw`：把 `start-bridge.vbs` 里的 `pythonw.exe` 换成完整路径，例如
> `C:\Users\<你>\scoop\apps\miniforge3\current\pythonw.exe`。
> 想临时停掉：任务管理器里结束 `pythonw.exe`；想取消自启：把「启动」文件夹里的快捷方式删掉。

## 说明与限制
- **仅 Windows**（SMTC 是 Windows 的系统能力）。macOS/手机不适用。
- 只同步**元数据**（歌名/歌手/封面/进度），好友**听不到你的音频流** —— 各自在自己客户端跟听。
- 支持任何上报 SMTC 的播放器：网易云 3.0+ / Spotify / QQ音乐 / foobar2000 等。
- 90 秒没更新的会标记为「离线」。

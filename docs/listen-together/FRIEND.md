# 加入「一起听」（发给好友的说明）

在 logicweaver.me 的「🎧 一起听」板上，和大家实时显示各自正在听的歌。你在**自己的网易云**里正常听（VIP 全曲库都行），网页只同步「正在听什么」。

## 你需要
- Windows 电脑（SMTC 是 Windows 的能力）
- 网易云音乐 **3.0 以上**（或任意支持 SMTC 的播放器：Spotify / QQ音乐 等）
- Python 3.9+（没有就去 python.org 装，安装时勾选 “Add to PATH”）

## 三步
1. 装依赖（命令行/PowerShell，秒装）：
   ```
   pip install requests winrt-runtime winrt-Windows.Media.Control winrt-Windows.Storage.Streams winrt-Windows.Foundation
   ```
2. 打开 `smtcbridge-friend.py`（记事本即可），**只改最上面两行**：
   ```python
   MY_ID   = "你的英文id"   # 唯一，别跟别人重复，如 alice、bob123
   MY_NAME = "你的昵称"     # 板上显示的名字，中文随意
   ```
   保存。
3. 运行：
   ```
   python smtcbridge-friend.py
   ```
   打开网易云放首歌，命令行出现 `♪ 歌名 - 歌手` 就成了。去 logicweaver.me 顶栏点「🎧 一起听」能看到自己和大家。

## 想开机自动后台跑（可选）
把随附的 `start-bridge.vbs` 放到脚本同一个文件夹，`Win+R` → `shell:startup` → 把 vbs 的快捷方式放进去。以后开机静默运行，无黑框。
（注意：vbs 默认找 `smtcbridge.py`；要么把脚本改名成 `smtcbridge.py`，要么把 vbs 里的文件名改成 `smtcbridge-friend.py`。）

## 说明
- 只同步歌名/歌手/封面/进度，别人**听不到你的音频**，各自在自己客户端听。
- 仅 Windows。90 秒没更新会显示「离线」。

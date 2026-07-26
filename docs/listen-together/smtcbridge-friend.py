#!/usr/bin/env python3
# 好友版 —— 加入 w空竹w 的「一起听」
#
# 你只需要改下面两行：MY_ID 和 MY_NAME，其它都填好了。
#
# 准备（Windows + 网易云 3.0 以上，或任意支持 SMTC 的播放器）：
#   1) 装 Python（python.org 或 miniforge 都行）
#   2) 装依赖（有预编译包，秒装）：
#      pip install requests winrt-runtime winrt-Windows.Media.Control winrt-Windows.Storage.Streams winrt-Windows.Foundation
#   3) 改下面两行，保存
#   4) 运行：python smtcbridge-friend.py
#      （想开机自启+后台静默，见随附的 start-bridge.vbs 说明）

# ======================== 只改这两行 ========================
MY_ID   = "改成你的英文id"   # 唯一 id，英文/数字，别跟别人重复（如 alice、bob123）
MY_NAME = "改成你的昵称"     # 板上显示的名字，中文随意
# ===========================================================

import asyncio
import base64
import os
import time
import requests

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "smtc-bridge.log")


def log(msg):
    line = time.strftime("%m-%d %H:%M:%S ") + str(msg)
    print(line)
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > 1_000_000:
            open(LOG_FILE, "w").close()
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


try:
    from winrt.windows.media.control import (
        GlobalSystemMediaTransportControlsSessionManager as MediaManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
    )
    from winrt.windows.storage.streams import DataReader, Buffer, InputStreamOptions
except ImportError:
    from winsdk.windows.media.control import (
        GlobalSystemMediaTransportControlsSessionManager as MediaManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
    )
    from winsdk.windows.storage.streams import DataReader, Buffer, InputStreamOptions

# ------- 这些不用改（已配好） -------
FUNCTION_URL = "https://auxlxuyhhzguxjvneanw.supabase.co/functions/v1/now-playing"
PUSH_TOKEN   = "问-w空竹w-要-token"   # 公开仓库里不放真 token；跟 w空竹w 要一串填这里
HANDLE       = MY_ID
DISPLAY_NAME = MY_NAME
PREFER_APP   = "cloudmusic"
INTERVAL     = 5
SEND_COVER   = True
# ------------------------------------

STATUS_MAP = {
    PlaybackStatus.PLAYING: "playing",
    PlaybackStatus.PAUSED: "paused",
    PlaybackStatus.STOPPED: "stopped",
    PlaybackStatus.CHANGING: "playing",
}


async def read_thumbnail(ref):
    try:
        stream = await ref.open_read_async()
        size = stream.size
        if not size:
            return None
        buf = Buffer(size)
        await stream.read_async(buf, size, InputStreamOptions.READ_AHEAD)
        reader = DataReader.from_buffer(buf)
        data = bytes(reader.read_bytes(buf.length))
        return "data:image/jpeg;base64," + base64.b64encode(data).decode()
    except Exception:
        return None


async def pick_session(mgr):
    try:
        sessions = mgr.get_sessions()
    except Exception:
        sessions = []
    if PREFER_APP:
        for s in sessions:
            try:
                if PREFER_APP.lower() in (s.source_app_user_model_id or "").lower():
                    return s
            except Exception:
                pass
    return mgr.get_current_session()


def ms(timespan):
    try:
        return int(timespan.total_seconds() * 1000)
    except Exception:
        return 0


async def snapshot(want_cover):
    mgr = await MediaManager.request_async()
    s = await pick_session(mgr)
    if not s:
        return None
    props = await s.try_get_media_properties_async()
    tl = s.get_timeline_properties()
    info = s.get_playback_info()
    app_id = s.source_app_user_model_id or ""
    app_name = "网易云" if "cloudmusic" in app_id.lower() else (app_id.split("!")[0] or "SMTC")
    cover = None
    if want_cover and SEND_COVER and props.thumbnail:
        cover = await read_thumbnail(props.thumbnail)
    return {
        "handle": HANDLE,
        "display_name": DISPLAY_NAME,
        "title": props.title or None,
        "artist": props.artist or None,
        "album": props.album_title or None,
        "cover": cover,
        "status": STATUS_MAP.get(info.playback_status, "stopped"),
        "position_ms": ms(tl.position),
        "duration_ms": ms(tl.end_time),
        "app": app_name,
    }


def push(payload):
    try:
        r = requests.post(
            FUNCTION_URL,
            json=payload,
            headers={"x-push-token": PUSH_TOKEN, "Content-Type": "application/json"},
            timeout=10,
        )
        if r.status_code != 200:
            log(f"push failed {r.status_code} {r.text[:200]}")
    except Exception as e:
        log(f"push error {e}")


async def main():
    if MY_ID.startswith("改成") or MY_NAME.startswith("改成") or not MY_ID.strip():
        log("请先在文件顶部把 MY_ID 和 MY_NAME 改成你自己的，再运行。")
        raise SystemExit(1)
    log(f"SMTC bridge started for {DISPLAY_NAME} ({HANDLE}), every {INTERVAL}s")
    last_key = None
    while True:
        try:
            probe = await snapshot(want_cover=False)
            if probe and probe["title"]:
                key = (probe["title"], probe["artist"])
                if key != last_key:
                    full = await snapshot(want_cover=True)
                    push(full or probe)
                    last_key = key
                    log(f"♪ {probe['title']} - {probe['artist']} [{probe['status']}]")
                else:
                    push(probe)
                    log(f"· {probe['title']} [{probe['status']}] {probe['position_ms'] // 1000}s")
        except Exception as e:
            log(f"loop error {e}")
        await asyncio.sleep(INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())

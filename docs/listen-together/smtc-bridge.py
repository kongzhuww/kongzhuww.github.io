#!/usr/bin/env python3
# SMTC -> Supabase bridge.
# Reads Windows "now playing" (System Media Transport Controls) and pushes it to
# the site's Supabase every few seconds, so the "好友在听" board shows it live.
#
# Works with any app that reports to SMTC: 网易云音乐 3.0+, Spotify, QQ音乐, foobar2000...
#
# Setup (Windows, Python 3.9+):
#   pip install winsdk requests
# Fill in CONFIG below, then run:
#   python smtc-bridge.py
#
# Each friend runs their own copy with their own HANDLE / DISPLAY_NAME and the
# shared PUSH_TOKEN.

import asyncio
import base64
import os
import time
import requests

# Log to a file next to this script, so silent background runs stay debuggable.
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "smtc-bridge.log")


def log(msg):
    line = time.strftime("%m-%d %H:%M:%S ") + str(msg)
    print(line)
    try:
        # keep the log small: truncate if it grows past ~1 MB
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > 1_000_000:
            open(LOG_FILE, "w").close()
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

# Works with either binding: PyWinRT split packages (prebuilt wheels, fast) or
# the older monolithic winsdk (compiles from source). Install whichever you have:
#   pip install winrt-runtime winrt-Windows.Media.Control winrt-Windows.Storage.Streams winrt-Windows.Foundation
#   -- or --
#   pip install winsdk
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

# ------------------------- CONFIG -------------------------
FUNCTION_URL = "https://auxlxuyhhzguxjvneanw.supabase.co/functions/v1/now-playing"
PUSH_TOKEN   = "PUT-YOUR-NP_PUSH_TOKEN-HERE"   # 与 Supabase 里 NP_PUSH_TOKEN 一致
HANDLE       = "kong"        # 你的唯一 id（英文/数字，别人别重复）
DISPLAY_NAME = "Kong"        # 显示名
PREFER_APP   = "cloudmusic"  # 优先抓的 app（网易云进程含 cloudmusic）；留空=系统当前会话
INTERVAL     = 5             # 上报间隔（秒）
SEND_COVER   = True          # 是否上传封面（base64；每首歌变化时才重传）
# ----------------------------------------------------------

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
    # winsdk maps Windows.Foundation.TimeSpan to datetime.timedelta
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
    log(f"SMTC bridge started for {DISPLAY_NAME} ({HANDLE}), every {INTERVAL}s")
    last_key = None
    while True:
        try:
            probe = await snapshot(want_cover=False)
            if probe and probe["title"]:
                key = (probe["title"], probe["artist"])
                if key != last_key:
                    # track changed: upload the cover once (edge fn keeps it after)
                    full = await snapshot(want_cover=True)
                    push(full or probe)
                    last_key = key
                    log(f"♪ {probe['title']} - {probe['artist']} [{probe['status']}]")
                else:
                    # same track: send position/status only; null cover is ignored
                    push(probe)
                    log(f"· {probe['title']} [{probe['status']}] {probe['position_ms'] // 1000}s")
        except Exception as e:
            log(f"loop error {e}")
        await asyncio.sleep(INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())

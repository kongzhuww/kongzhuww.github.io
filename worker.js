// Cloudflare Worker: serve the static site and same-origin proxy a couple of
// cross-origin APIs so the browser never issues a cross-origin request.
//   /siren/* -> Monster Siren (Arknights music) API
//   /bili/*  -> Bilibili API (public favourites). Bilibili risk-control (HTTP
//               412) needs a browser-like request WITH a buvid cookie, which we
//               fetch once from the fingerprint endpoint and reuse.
// Media and image files are still loaded by the client directly.

const PROXIES = {
  "/siren/": { base: "https://monster-siren.hypergryph.com/api" },
  "/bili/": { base: "https://api.bilibili.com", bili: true },
  "/aihot/": { base: "https://aihot.virxact.com/api" },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Cached across requests in the same isolate.
let biliCookie = null;

// Minimal browser-fingerprint payload used to "activate" a fresh buvid so the
// favourites endpoints stop returning HTTP 412 (risk control).
function activatePayload(uuid) {
  return {
    "3064": 1,
    "5062": String(1700000000000),
    "03bf": "https://www.bilibili.com/",
    "39c8": "333.1007.fp.risk",
    "34f1": "",
    "d402": "",
    "654a": "",
    "6e7c": "1920x1080",
    "3c43": {
      "2673": 0,
      "5766": 24,
      "6527": 0,
      "7003": 1,
      "807e": 1,
      "b8ce": UA,
      "641c": 0,
      "07a4": "zh-CN",
      "1c57": "not available",
      "0bd0": 16,
      "748e": [1920, 1080],
      "d61f": [1920, 1040],
      "fc9d": -480,
      "6aa9": "Asia/Shanghai",
      "75b8": 1,
      "3b21": 1,
      "8a1c": 0,
      "d52f": "not available",
      "b8c6": "",
      "ba75": "",
      "9dff": "",
      "5271": 0,
      "f4c2": uuid,
    },
    "54ef": "{}",
    "8b94": "",
    "df35": uuid,
    "07a4": "zh-CN",
    "5f45": null,
    "db46": 0,
  };
}

function uuid() {
  const s = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 32; i++) out += s[(i * 7 + 13) % 16];
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20)}infoc`;
}

async function getBiliCookie() {
  if (biliCookie) return biliCookie;
  try {
    const r = await fetch("https://api.bilibili.com/x/frontend/finger/spi", {
      headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/" },
    });
    const j = await r.json();
    const b3 = j?.data?.b_3;
    const b4 = j?.data?.b_4;
    if (!b3) return "";
    const cookie = `buvid3=${b3}; buvid4=${b4 || ""}; b_nut=${Math.floor(Date.now() / 1000)}; _uuid=${uuid()}`;
    // Activate the buvid so the risk-control (HTTP 412) is cleared.
    try {
      await fetch("https://api.bilibili.com/x/internal/gaia-gateway/ExClimbWuzhi", {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Referer: "https://www.bilibili.com/",
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ payload: JSON.stringify(activatePayload(uuid())) }),
      });
    } catch {
      /* activation best-effort */
    }
    biliCookie = cookie;
  } catch {
    /* ignore */
  }
  return biliCookie || "";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    for (const [prefix, cfg] of Object.entries(PROXIES)) {
      if (!url.pathname.startsWith(prefix)) continue;

      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "content-type, accept",
          },
        });
      }

      const target = cfg.base + url.pathname.slice(prefix.length - 1) + url.search;
      const headers = { Accept: "application/json", "User-Agent": UA };
      if (cfg.bili) {
        headers["Referer"] = "https://www.bilibili.com/";
        headers["Origin"] = "https://www.bilibili.com";
        headers["Accept-Language"] = "zh-CN,zh;q=0.9";
        const cookie = await getBiliCookie();
        if (cookie) headers["Cookie"] = cookie;
      }

      try {
        const upstream = await fetch(target, {
          headers,
          cf: { cacheTtl: 120, cacheEverything: true },
        });
        const out = new Headers();
        out.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
        out.set("Access-Control-Allow-Origin", "*");
        out.set("Cache-Control", "public, max-age=120");
        return new Response(upstream.body, { status: upstream.status, headers: out });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 502,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    return env.ASSETS.fetch(request);
  },
};

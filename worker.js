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

async function getBiliCookie() {
  if (biliCookie) return biliCookie;
  try {
    const r = await fetch("https://api.bilibili.com/x/frontend/finger/spi", {
      headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/" },
    });
    const j = await r.json();
    const b3 = j?.data?.b_3;
    const b4 = j?.data?.b_4;
    if (b3) biliCookie = `buvid3=${b3}; buvid4=${b4 || ""}`;
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

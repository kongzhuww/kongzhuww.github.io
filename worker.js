// Cloudflare Worker: serve the static site and same-origin proxy cross-origin
// APIs so the browser never issues a cross-origin request.
//   /siren/* -> Monster Siren (Arknights music) API
//   /aihot/* -> AI HOT public read-only API
//   /bili/*  -> Bilibili. Bilibili blocks datacenter IPs (HTTP 412), so we try
//               the user's VPS proxy first and fall back to a direct call.

const PROXIES = {
  "/siren/": { base: "https://monster-siren.hypergryph.com/api" },
  "/aihot/": { base: "https://aihot.virxact.com/api" },
};

// The user's VPS runs a tiny proxy (bili-proxy.py) that forwards to Bilibili and
// exposes /stats. Requests from a VPS IP are not risk-controlled like Cloudflare
// IPs. IMPORTANT: Cloudflare Workers cannot fetch a raw IP (error 1003) — this
// MUST be a hostname. vps.logicweaver.me is a grey-cloud (DNS-only) A record
// pointing at the VPS, which listens on 8080 (plain HTTP on that port).
const BILI_VPS = "http://vps.logicweaver.me:8080";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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
    if (b3) biliCookie = `buvid3=${b3}; buvid4=${b4 || ""}; b_nut=${Math.floor(Date.now() / 1000)}`;
  } catch {
    /* ignore */
  }
  return biliCookie || "";
}

function corsJson(upstream) {
  const out = new Headers();
  out.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
  out.set("Access-Control-Allow-Origin", "*");
  out.set("Cache-Control", "public, max-age=120");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

async function handleBili(url) {
  const rest = url.pathname.slice("/bili".length) + url.search; // "/x/v3/..."

  // 1) Try the VPS proxy first (short timeout).
  if (BILI_VPS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const vres = await fetch(BILI_VPS + rest, {
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (vres.ok) return corsJson(vres);
    } catch {
      /* fall through to direct */
    }
  }

  // 2) Fallback: direct call with buvid + browser headers.
  const target = "https://api.bilibili.com" + rest;
  const headers = {
    Accept: "application/json",
    "User-Agent": UA,
    Referer: "https://www.bilibili.com/",
    Origin: "https://www.bilibili.com",
    "Accept-Language": "zh-CN,zh;q=0.9",
  };
  const cookie = await getBiliCookie();
  if (cookie) headers["Cookie"] = cookie;
  const upstream = await fetch(target, { headers, cf: { cacheTtl: 120, cacheEverything: true } });
  return corsJson(upstream);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Version probe so we can confirm which worker build is live.
    if (url.pathname === "/__version") {
      return new Response("worker v10 · bili->vps.logicweaver.me:8080 · /vps/* · /lyric · from-github", {
        headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Lyric proxy: /lyric?url=<encoded hycdn/hypergryph url> -> text with CORS.
    // Monster Siren serves LRC lyrics on its CDN without CORS headers; forward
    // them same-origin. Restricted to the official hosts so it is not an open proxy.
    if (url.pathname === "/lyric") {
      const target = url.searchParams.get("url") || "";
      if (!/^https:\/\/[^/]+\.(hycdn\.cn|hypergryph\.com)\//.test(target)) {
        return new Response("bad url", { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
      }
      try {
        const upstream = await fetch(target, { cf: { cacheTtl: 3600, cacheEverything: true } });
        const out = new Headers();
        out.set("Content-Type", "text/plain; charset=utf-8");
        out.set("Access-Control-Allow-Origin", "*");
        out.set("Cache-Control", "public, max-age=3600");
        return new Response(upstream.body, { status: upstream.status, headers: out });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 502,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    if (request.method === "OPTIONS" && (url.pathname.startsWith("/bili/") || url.pathname.startsWith("/siren/") || url.pathname.startsWith("/aihot/"))) {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "content-type, accept",
        },
      });
    }

    if (url.pathname.startsWith("/bili/")) {
      try {
        return await handleBili(url);
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 502,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    // VPS probe: /vps/* -> VPS /*  (e.g. /vps/stats -> VPS /stats)
    if (url.pathname.startsWith("/vps/")) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const upstream = await fetch(BILI_VPS + url.pathname.slice("/vps".length) + url.search, {
          headers: { Accept: "application/json" },
          signal: ctrl.signal,
        });
        clearTimeout(t);
        return corsJson(upstream);
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e), offline: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    for (const [prefix, cfg] of Object.entries(PROXIES)) {
      if (!url.pathname.startsWith(prefix)) continue;
      const target = cfg.base + url.pathname.slice(prefix.length - 1) + url.search;
      try {
        const upstream = await fetch(target, {
          headers: { Accept: "application/json", "User-Agent": UA },
          cf: { cacheTtl: 120, cacheEverything: true },
        });
        return corsJson(upstream);
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

import { secureResponse } from "./security-headers.mjs";

// Public read-only proxies, NOT authenticated access to the upstream services.
// Never forward browser cookies, authorization headers, bodies, or arbitrary paths.
const BILI_VPS = "http://vps.logicweaver.me:8080";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const JSON_LIMIT = 2 * 1024 * 1024;
const LYRIC_LIMIT = 256 * 1024;
const LYRIC_HOSTS = new Set(["res01.hycdn.cn", "res02.hycdn.cn", "web.hycdn.cn"]);

class UpstreamError extends Error {}

function jsonError(status, message, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Deadline covers BOTH response headers and body consumption. Buffering has a
// hard limit, even for chunked responses and dishonest Content-Length headers.
async function boundedFetch(target, { headers = {}, timeout = 8000, limit = JSON_LIMIT } = {}) {
  const controller = new AbortController();
  let timer;
  let reader;
  const work = (async () => {
    const response = await fetch(target, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: controller.signal,
    });
    // Never follow a redirect, including redirects from the VPS to another host.
    if (response.status >= 300 && response.status < 400) throw new UpstreamError("redirect");
    if (!response.ok) throw new UpstreamError("status");
    const length = response.headers.get("Content-Length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) {
      throw new UpstreamError("size");
    }
    const chunks = [];
    let size = 0;
    reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) throw new UpstreamError("size");
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  })();
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new UpstreamError("timeout"));
    }, timeout);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) void reader.cancel().catch(() => {});
  }
}

async function fetchJson(target, options) {
  const bytes = await boundedFetch(target, options);
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (value === null || typeof value !== "object") throw new Error("not an object");
    return value;
  } catch {
    throw new UpstreamError("invalid-json");
  }
}

function jsonResponse(value, cacheSeconds = 120) {
  // API-level failures (e.g. Bilibili risk control) must not be publicly cached.
  const success = !value.error && (value.code === undefined || value.code === 0);
  return new Response(JSON.stringify(value), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": success && cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : "no-store",
    },
  });
}

function validQuery(url, rules) {
  const seen = new Set();
  for (const [key, value] of url.searchParams) {
    if (seen.has(key) || !Object.hasOwn(rules, key) || !rules[key](value)) return false;
    seen.add(key);
  }
  return Object.keys(rules).every((key) => seen.has(key));
}
const digits = (s) => /^\d{1,20}$/.test(s) && Number(s) > 0;
const integer = (max) => (s) => /^\d{1,4}$/.test(s) && Number(s) >= 1 && Number(s) <= max;
const equals = (expected) => (s) => s === expected;

function biliAllowed(url) {
  switch (url.pathname) {
    case "/bili/x/v3/fav/folder/created/list-all":
      return validQuery(url, { up_mid: equals("668709429") });
    case "/bili/x/v3/fav/resource/list":
      return validQuery(url, { media_id: digits, pn: integer(100), ps: integer(24), platform: equals("web") });
    case "/bili/x/web-interface/search/type":
      return validQuery(url, {
        search_type: equals("video"), page: equals("1"),
        keyword: (s) => s.trim().length > 0 && s.length <= 200 && !/[\x00-\x1f\x7f]/.test(s),
      });
    default:
      return false;
  }
}

function proxyTarget(url) {
  if (url.pathname === "/vps/stats" && !url.search) return `${BILI_VPS}/stats`;
  if (biliAllowed(url)) {
    return "https://api.bilibili.com" + url.pathname.slice("/bili".length) + url.search;
  }
  if (!url.search && /^\/siren\/(?:albums|songs|song\/\d{1,20}|album\/\d{1,20}\/detail)$/.test(url.pathname)) {
    return "https://monster-siren.hypergryph.com/api" + url.pathname.slice("/siren".length);
  }
  if (url.pathname === "/aihot/v1/items" && validQuery(url, {
    mode: equals("selected"), window: (s) => s === "24h" || s === "7d", limit: integer(20),
  })) {
    return "https://aihot.virxact.com/api/v1/items" + url.search;
  }
  return null;
}

function lyricTarget(url) {
  if (!validQuery(url, { url: (s) => s.length <= 2048 })) return null;
  try {
    const target = new URL(url.searchParams.get("url"));
    if (target.protocol !== "https:" || target.username || target.password || target.port || target.hash) return null;
    if (!LYRIC_HOSTS.has(target.hostname)) return null;
    // Lyrics are plain LRC files on the Siren CDN, not arbitrary CDN downloads.
    if (!/^\/[A-Za-z0-9_/-]*siren\/lyric\/[A-Za-z0-9_/-]+\.lrc$/.test(target.pathname) || target.search) return null;
    return target.href;
  } catch {
    return null;
  }
}

let biliCookie = null;
async function getBiliCookie() {
  if (biliCookie) return biliCookie;
  try {
    const j = await fetchJson("https://api.bilibili.com/x/frontend/finger/spi", {
      headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/" }, timeout: 3000,
    });
    const b3 = j?.data?.b_3;
    const b4 = j?.data?.b_4 || "";
    // Do not copy arbitrary upstream text into a Cookie header.
    if (typeof b3 === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(b3) && /^[A-Za-z0-9_-]{0,128}$/.test(b4)) {
      biliCookie = `buvid3=${b3}; buvid4=${b4}; b_nut=${Math.floor(Date.now() / 1000)}`;
    }
  } catch {
    // An anonymous direct request remains available if the fingerprint API fails.
  }
  return biliCookie || "";
}

async function handleBili(url, target) {
  try {
    const value = await fetchJson(BILI_VPS + url.pathname.slice("/bili".length) + url.search, {
      headers: { Accept: "application/json" }, timeout: 4000,
    });
    if (value.code === 0) return jsonResponse(value);
  } catch {
    // Fall back only to the fixed official endpoint, never an upstream Location.
  }
  const headers = {
    Accept: "application/json", "User-Agent": UA,
    Referer: "https://www.bilibili.com/", Origin: "https://www.bilibili.com",
    "Accept-Language": "zh-CN,zh;q=0.9",
  };
  const cookie = await getBiliCookie();
  if (cookie) headers.Cookie = cookie;
  return jsonResponse(await fetchJson(target, { headers }));
}

async function handle(request, env) {
  const url = new URL(request.url);
  const dynamic = url.pathname === "/lyric" || url.pathname === "/__version" ||
    /^\/(?:vps|bili|siren|aihot)(?:\/|$)/.test(url.pathname);
  if (!dynamic) return env.ASSETS.fetch(request);
  if (request.url.length > 4096) return jsonError(414, "URL too long");
  const target = url.pathname === "/lyric" ? lyricTarget(url) : proxyTarget(url);
  if (!target && url.pathname !== "/__version") return jsonError(404, "Not found");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const response = jsonError(405, "Method not allowed");
    response.headers.set("Allow", "GET, HEAD, OPTIONS");
    return response;
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { Allow: "GET, HEAD, OPTIONS", "Cache-Control": "no-store" } });
  }
  // The frontend is same-origin. Deliberately no wildcard CORS headers.
  if (url.pathname === "/__version") {
    return new Response("worker v11-security", {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  try {
    if (url.pathname === "/lyric") {
      const body = await boundedFetch(target, { limit: LYRIC_LIMIT });
      return new Response(body, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      });
    }
    if (url.pathname.startsWith("/bili/")) return await handleBili(url, target);
    const value = await fetchJson(target, {
      headers: { Accept: "application/json", "User-Agent": UA },
      timeout: url.pathname === "/vps/stats" ? 4000 : 8000,
    });
    return jsonResponse(value, url.pathname === "/vps/stats" ? 0 : 120);
  } catch {
    // Never expose upstream exception strings, URLs, or response bodies.
    console.warn("proxy request failed", url.pathname.split("/")[1]);
    return jsonError(502, "Upstream unavailable", url.pathname === "/vps/stats" ? { offline: true } : {});
  }
}

const worker = {
  async fetch(request, env) {
    try {
      return secureResponse(await handle(request, env), request.method);
    } catch {
      console.warn("worker request failed");
      return secureResponse(jsonError(502, "Service unavailable"), request.method);
    }
  },
};

export default worker;

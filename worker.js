// Cloudflare Worker: serve the static site and same-origin proxy a couple of
// cross-origin APIs so the browser never issues a cross-origin request.
//   /siren/* -> Monster Siren (Arknights music) API
//   /bili/*  -> Bilibili API (public favourites), with a bilibili Referer so the
//               anti-crawl / risk-control check passes.
// Media and image files are still loaded by the client directly.

const PROXIES = {
  "/siren/": { base: "https://monster-siren.hypergryph.com/api" },
  "/bili/": { base: "https://api.bilibili.com", referer: "https://www.bilibili.com" },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

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
      if (cfg.referer) headers["Referer"] = cfg.referer;

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

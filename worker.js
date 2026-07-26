// Cloudflare Worker: serve the static site, and same-origin proxy the
// Monster Siren (Arknights) music API under /siren/* so the browser never hits
// a cross-origin request. Audio/cover files are streamed by the client directly.

const SIREN_API = "https://monster-siren.hypergryph.com/api";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/siren/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "content-type, accept",
          },
        });
      }
      const target = SIREN_API + url.pathname.slice("/siren".length) + url.search;
      try {
        const upstream = await fetch(target, {
          headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
          cf: { cacheTtl: 300, cacheEverything: true },
        });
        const headers = new Headers();
        headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Cache-Control", "public, max-age=300");
        return new Response(upstream.body, { status: upstream.status, headers });
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

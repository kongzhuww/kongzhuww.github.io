import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test, afterEach } from "node:test";
import worker from "../worker.js";
import { SECURITY_HEADERS } from "../security-headers.mjs";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const env = { ASSETS: { fetch: async () => new Response("asset", { headers: { "Content-Type": "text/html", ETag: "asset-tag" } }) } };
const request = (path, options) => worker.fetch(new Request(`https://logicweaver.me${path}`, options), env);
const lyric = "https://res01.hycdn.cn/hash/siren/lyric/20260718/abc.lrc";
const lyricPath = (target = lyric) => `/lyric?url=${encodeURIComponent(target)}`;
function noNetwork() { globalThis.fetch = () => { assert.fail("invalid request reached upstream"); }; }
function stubJson(value = { code: 0, data: [] }) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(value);
  };
  return calls;
}
function checkSecurity(response) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) assert.equal(response.headers.get(key), value);
  assert.equal(response.headers.has("Access-Control-Allow-Origin"), false);
}

test("static and dynamic responses carry the same baseline security headers", async () => {
  noNetwork();
  for (const path of ["/", "/__version", "/vps/admin"]) checkSecurity(await request(path));
  const asset = await request("/");
  assert.equal(asset.headers.get("ETag"), "asset-tag");
  const file = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
  assert.equal(file, "/*\n" + Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`).join("\n") + "\n");
  const config = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  const patterns = JSON.parse(config.match(/^run_worker_first = (\[.*\])$/m)[1]);
  for (const path of ["/vps", "/vps/*", "/bili", "/bili/*", "/siren", "/siren/*", "/aihot", "/aihot/*", "/lyric", "/__version"]) {
    assert.ok(patterns.includes(path));
  }
});

test("every shipped JSON endpoint remains available", async () => {
  const paths = [
    "/vps/stats", "/siren/albums", "/siren/songs", "/siren/song/048756", "/siren/album/123/detail",
    "/aihot/v1/items?mode=selected&window=24h&limit=20",
    "/aihot/v1/items?mode=selected&window=7d&limit=20",
    "/bili/x/v3/fav/folder/created/list-all?up_mid=668709429",
    "/bili/x/v3/fav/resource/list?media_id=123&pn=1&ps=24&platform=web",
    "/bili/x/web-interface/search/type?search_type=video&page=1&keyword=%E9%9F%B3%E4%B9%90",
  ];
  const calls = stubJson();
  for (const path of paths) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    checkSecurity(response);
    assert.deepEqual(await response.json(), { code: 0, data: [] });
  }
  assert.equal(calls.length, paths.length);
  for (const { init } of calls) {
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "manual");
    assert.ok(init.signal.aborted, "deadline controller must be cleaned up after body completion");
  }
});

test("arbitrary proxy paths and query widening never reach upstream", async () => {
  noNetwork();
  const paths = [
    "/vps", "/vps/", "/vps/admin", "/vps/stats?secret=anything", "/vps/%2Fstats", "/vps/stats/extra",
    "/bili/x/passport-login/web/login", "/bili/x/v3/fav/folder/created/list-all?up_mid=1",
    "/bili/x/v3/fav/resource/list?media_id=1&pn=1&ps=10000&platform=web",
    "/bili/x/web-interface/search/type?search_type=video&page=1&keyword=x&callback=alert",
    "/bili/x/web-interface/search/type?search_type=video&page=1&keyword=x&keyword=y",
    "/bili/x/web-interface/search/type?search_type=video&page=1&keyword=%0A",
    "/siren/song/..%2F..%2Fadmin", "/siren/songs?url=https://example.com", "/siren/songs/extra",
    "/aihot/admin", "/aihot/v1/items?mode=selected&window=all&limit=20",
    "/aihot/v1/items?mode=selected&window=24h&limit=9999",
    "/aihot/v1/items?mode=selected&window=24h&limit=20&__proto__=x",
  ];
  for (const path of paths) {
    const response = await request(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    checkSecurity(response);
  }
});

test("only GET, HEAD and OPTIONS are accepted on public proxy endpoints", async () => {
  noNetwork();
  for (const path of ["/vps/stats", "/siren/songs", lyricPath(), "/__version"]) {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const response = await request(path, { method, body: "ignored" });
      assert.equal(response.status, 405);
      assert.equal(response.headers.get("Allow"), "GET, HEAD, OPTIONS");
    }
    const options = await request(path, { method: "OPTIONS" });
    assert.equal(options.status, 204);
    assert.equal(options.headers.has("Access-Control-Allow-Origin"), false);
  }
});

test("HEAD preserves status and headers without returning a body", async () => {
  stubJson();
  for (const path of ["/", "/vps/stats", "/siren/songs", "/__version", "/vps/admin"]) {
    const response = await request(path, { method: "HEAD" });
    assert.equal(await response.text(), "");
    checkSecurity(response);
  }
});

test("URL size limit is checked before forwarding", async () => {
  noNetwork();
  assert.equal((await request(`/lyric?url=${"a".repeat(4096)}`)).status, 414);
});

test("lyric requests accept only exact hosts, HTTPS and LRC paths", async () => {
  noNetwork();
  const invalid = [
    "http://res01.hycdn.cn/siren/lyric/a.lrc",
    "https://res01.hycdn.cn.evil.example/siren/lyric/a.lrc",
    "https://evil.example/siren/lyric/a.lrc",
    "https://other.hycdn.cn/siren/lyric/a.lrc",
    "https://user:pass@res01.hycdn.cn/siren/lyric/a.lrc",
    "https://res01.hycdn.cn:444/siren/lyric/a.lrc",
    "https://res01.hycdn.cn/siren/audio/a.wav",
    "https://res01.hycdn.cn/siren/lyric/a.lrc?redirect=https://example.com",
    "https://res01.hycdn.cn/siren/lyric/a.lrc#fragment",
    "https://res01.hycdn.cn/siren/lyric/%2e%2e/audio.wav",
    "https://res01.hycdn.cn/siren/lyric/a.lrc%00",
    "file:///etc/passwd", "not a url",
  ];
  for (const target of invalid) assert.equal((await request(lyricPath(target))).status, 404, target);
  assert.equal((await request(`${lyricPath()}&url=${encodeURIComponent(lyric)}`)).status, 404);
});

test("lyrics are served as nosniff text and not executable upstream content", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, lyric);
    assert.equal(init.redirect, "manual");
    return new Response("[00:01.00]hello", { headers: { "Content-Type": "text/html", "Set-Cookie": "bad=1" } });
  };
  const response = await request(lyricPath());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/plain; charset=utf-8");
  assert.equal(response.headers.has("Set-Cookie"), false);
  assert.equal(await response.text(), "[00:01.00]hello");
  checkSecurity(response);
});

test("redirects are rejected rather than followed for every upstream class", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(init.redirect, "manual");
    return new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/private" } });
  };
  for (const path of ["/vps/stats", "/siren/songs", "/aihot/v1/items?mode=selected&window=24h&limit=20", lyricPath()]) {
    assert.equal((await request(path)).status, 502);
  }
  assert.equal(calls.length, 4);
});

test("browser credentials are never forwarded and upstream headers are not reflected", async () => {
  globalThis.fetch = async (_, init) => {
    const headers = new Headers(init.headers);
    for (const key of ["Authorization", "Cookie", "Origin", "X-Push-Token"]) assert.equal(headers.has(key), false);
    return new Response('{"data":[]}', {
      headers: { "Content-Type": "text/html", "Set-Cookie": "upstream=secret", "Access-Control-Allow-Origin": "*" },
    });
  };
  const response = await request("/siren/songs", {
    headers: { Authorization: "Bearer browser-secret", Cookie: "session=browser-secret", "X-Push-Token": "browser-secret", Origin: "https://untrusted.example" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.equal(response.headers.has("Set-Cookie"), false);
  checkSecurity(response);
});

test("errors hide internal details, use no-store and retain VPS offline semantics", async () => {
  globalThis.fetch = async () => { throw new Error("private-token and private-upstream-host"); };
  for (const path of ["/vps/stats", "/siren/songs", lyricPath()]) {
    const response = await request(path);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const value = await response.json();
    assert.equal(value.error, "Upstream unavailable");
    assert.equal(value.offline, path === "/vps/stats" ? true : undefined);
    assert.ok(!JSON.stringify(value).includes("private"));
  }
});

test("VPS statistics and upstream API-level errors are not cached", async () => {
  stubJson();
  assert.equal((await request("/vps/stats")).headers.get("Cache-Control"), "no-store");
  stubJson({ code: -412, message: "blocked" });
  assert.equal((await request("/siren/songs")).headers.get("Cache-Control"), "no-store");
  stubJson({ error: "failed" });
  assert.equal((await request("/siren/songs")).headers.get("Cache-Control"), "no-store");
});

test("HTTP failures and non-JSON responses fail closed", async () => {
  for (const response of [new Response("upstream internal error", { status: 500 }), new Response("<html>bad gateway</html>"), Response.json(null)]) {
    globalThis.fetch = async () => response;
    const result = await request("/siren/songs");
    assert.equal(result.status, 502);
    assert.equal(result.headers.get("Cache-Control"), "no-store");
  }
});

test("declared and chunked oversized responses are bounded", async () => {
  for (const path of ["/siren/songs", lyricPath()]) {
    globalThis.fetch = async () => new Response("small", { headers: { "Content-Length": "100000000" } });
    assert.equal((await request(path)).status, 502);
    globalThis.fetch = async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
        controller.close();
      },
    }));
    assert.equal((await request(path)).status, 502);
  }
});

test("deadline includes a stalled response body and cancels it", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  let cancelled = false;
  globalThis.fetch = async () => new Response(new ReadableStream({
    pull() { started(); },
    cancel() { cancelled = true; },
  }));
  const result = request("/siren/songs");
  await ready;
  t.mock.timers.tick(8001);
  const response = await result;
  assert.equal(response.status, 502);
  assert.equal(cancelled, true);
  t.mock.timers.reset();
});

test("Bilibili still falls back to the fixed official API", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(init.redirect, "manual");
    if (String(url).startsWith("http://vps.")) return new Response("offline", { status: 503 });
    if (String(url).includes("/finger/spi")) return Response.json({ data: {} });
    return Response.json({ code: 0, data: { result: [] } });
  };
  const path = "/bili/x/web-interface/search/type?search_type=video&page=1&keyword=music";
  const response = await request(path);
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    "http://vps.logicweaver.me:8080/x/web-interface/search/type?search_type=video&page=1&keyword=music",
    "https://api.bilibili.com/x/frontend/finger/spi",
    "https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=music",
  ]);
});

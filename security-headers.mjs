// Keep public/_headers in sync; the offline security tests verify both paths.
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  // These narrow directives are enforced without restricting existing scripts.
  "Content-Security-Policy": "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  // Trial policy only: inspect browser violations before enforcing. No external
  // report collector is configured, so page URLs are not sent to a third party.
  "Content-Security-Policy-Report-Only": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src 'self' https://api.github.com https://api.open-meteo.com https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net; media-src 'self' https://*.hycdn.cn blob:; frame-src https://player.bilibili.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
};

export function secureResponse(response, method = "GET") {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

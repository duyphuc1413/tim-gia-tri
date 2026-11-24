/**
 * CORS headers cho các Edge Function được gọi từ frontend GitHub Pages.
 */

export function getCorsHeaders(req, allowedOriginEnv) {
  const reqOrigin = req.headers.get("origin") || "";
  const allowed = [];
  if (allowedOriginEnv) {
    try {
      allowed.push(new URL(allowedOriginEnv).origin);
    } catch {
      allowed.push(allowedOriginEnv.replace(/\/+$/, ""));
    }
  }
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(reqOrigin);
  const origin =
    reqOrigin && (allowed.includes(reqOrigin) || isLocal)
      ? reqOrigin
      : allowed[0] || "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

// Small helpers so EVERY route answers any client:
//  - native Android apps (Kotlin, Flutter, React Native) don't need CORS, but it doesn't hurt them
//  - WebView / Capacitor / browser-based clients DO need it
// "*" is fine for a hackathon demo. Don't ship it like this to production.

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Answer the browser's "preflight" check. Export this as OPTIONS from every route. */
export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** JSON response with CORS headers. */
export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

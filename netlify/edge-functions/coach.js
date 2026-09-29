// Cultural Compass — AI proxy (Netlify Edge Function)
// Keeps the Anthropic API key on the server and streams Claude's answer back to the page.
// Set ANTHROPIC_API_KEY in Netlify: Site configuration > Environment variables.
// Optional: ANTHROPIC_MODEL to change the model without editing code.

const MAX_CHARS = 40000;      // total characters of conversation accepted per request
const MAX_TURNS = 20;         // most recent messages kept
const MAX_TOKENS_CAP = 2500;  // upper limit on answer length

export default async (req) => {
  const key = Netlify.env.get("ANTHROPIC_API_KEY");
  const model = Netlify.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";

  // Health check: the page calls GET /api/coach on load to see if the coach is connected.
  if (req.method === "GET") return Response.json({ ready: Boolean(key) }, { headers: { "cache-control": "no-store" } });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });

  // Only accept calls from this site's own pages.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return new Response("Forbidden", { status: 403 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "bad_request" }, { status: 400 }); }

  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_TURNS);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length) return Response.json({ error: "bad_request" }, { status: 400 });
  if (messages.reduce((n, m) => n + m.content.length, 0) > MAX_CHARS) return Response.json({ error: "too_large" }, { status: 413 });

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: Math.min(Number(body.max_tokens) || 1500, MAX_TOKENS_CAP),
      stream: true,
      messages,
    }),
  });

  if (!upstream.ok) {
    console.error("Anthropic API error", upstream.status, await upstream.text());
    const busy = upstream.status === 429 || upstream.status === 529;
    return Response.json({ error: busy ? "rate_limited" : "upstream" }, { status: busy ? 429 : 502 });
  }

  return new Response(upstream.body, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" },
  });
};

export const config = { path: "/api/coach" };

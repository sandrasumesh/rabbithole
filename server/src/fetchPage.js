// Fetches a page so the agent can summarize it. Returns only a short text excerpt:
// we never store or display full copies of articles.

const BLOCKED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[?::1\]?$)/i;

export function isFetchable(url) {
  try {
    const u = new URL(url);
    // Basic SSRF guard: only public http(s) pages, never internal network addresses.
    return ["http:", "https:"].includes(u.protocol) && !BLOCKED_HOSTS.test(u.hostname);
  } catch {
    return false;
  }
}

export async function fetchPageExcerpt(url, maxChars = 2000) {
  if (!isFetchable(url)) return { ok: false, error: "URL not allowed" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "RabbitHoleVisualizer/1.0" },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const html = (await res.text()).slice(0, 500_000);
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "";
    const description =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] || "";
    const text = html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
    return { ok: true, title, description, excerpt: text };
  } catch (err) {
    return { ok: false, error: err.name === "AbortError" ? "Timed out" : err.message };
  } finally {
    clearTimeout(timer);
  }
}

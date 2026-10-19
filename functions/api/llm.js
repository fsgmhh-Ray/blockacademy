// Cloudflare Pages Function — mirrors server/llmProxy.mjs.
// Relays the browser's OpenAI-compatible chat request to the upstream and
// streams the SSE response back. The browser still sends apiKey + baseUrl in
// the request body (same as the local proxy); this function only forwards.

function normalizeBaseUrl(baseUrl) {
  baseUrl = (baseUrl || '').trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(baseUrl)) baseUrl = baseUrl.replace(/\/chat\/completions$/, '');
  if (!/\/v\d+$/.test(baseUrl)) baseUrl += '/v1';
  return baseUrl;
}

function json(code, obj) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestPost({ request }) {
  let cfg;
  try {
    cfg = await request.json();
  } catch {
    return json(400, { error: 'Request body is not valid JSON' });
  }

  const apiKey = String(cfg.apiKey || '').trim();
  const baseUrl = normalizeBaseUrl(cfg.baseUrl);
  if (!baseUrl) return json(400, { error: 'Missing baseUrl: fill the API address in the settings panel first' });
  if (!apiKey) return json(400, { error: 'Missing apiKey: fill the API key in the settings panel first' });

  const upstream = `${baseUrl}/chat/completions`;
  const payload = {
    model: cfg.model || 'gpt-4o-mini',
    messages: cfg.messages || [],
    temperature: cfg.temperature ?? 0.85,
    max_tokens: cfg.max_tokens ?? 400,
    stream: true,
  };

  let upstreamRes;
  try {
    upstreamRes = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json(502, { error: `Cannot connect to ${upstream}: ${e?.message || e}` });
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    const txt = await upstreamRes.text().catch(() => '');
    let detail = txt;
    try {
      const j = JSON.parse(txt);
      detail = j?.error?.message || JSON.stringify(j);
    } catch {
      /* keep raw text */
    }
    return json(upstreamRes.status, { error: `Upstream returned ${upstreamRes.status}: ${detail}` });
  }

  return new Response(upstreamRes.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

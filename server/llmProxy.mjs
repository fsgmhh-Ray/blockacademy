/**
 * LLM 反向代理：浏览器 -> 本地代理 -> 大模型厂商
 * 目的有二：
 *   1) 绕过浏览器 CORS 限制（多数 OpenAI 兼容接口不允许前端直连）
 *   2) API Key 只存在于本地，不进入浏览器 /
 前端存储（Key 由设置面板填写，随请求体传来，仅限本机回环通信）
 */
export async function proxyLLM(req, res, body) {
  try {
    const cfg = typeof body === 'string' ? JSON.parse(body || '{}') : body || {};
    const apiKey = String(cfg.apiKey || '').trim();
    let baseUrl = String(cfg.baseUrl || '').trim();

    if (!baseUrl) {
      return sendJSON(res, 400, { error: '缺少 baseUrl：请先在设置面板填写 API 地址' });
    }
    if (!apiKey) {
      return sendJSON(res, 400, { error: '缺少 apiKey：请先在设置面板填写密钥' });
    }

    // URL 归一化：用户可能填到 /chat/completions、/v1、或根域名
    baseUrl = baseUrl.replace(/\/+$/, '');
    if (/\/chat\/completions$/.test(baseUrl)) baseUrl = baseUrl.replace(/\/chat\/completions$/, '');
    // Groq 的版本路径是 /openai/v1 而不是 /v1；填根域名时按通用规则拼 /v1 会 404
    if (/^https?:\/\/[^/]*groq\.com/i.test(baseUrl)) {
      baseUrl = baseUrl.replace(/\/openai(\/v\d+)?$/i, '').replace(/\/v\d+$/i, '');
      baseUrl += '/openai/v1';
    } else if (!/\/v\d+$/.test(baseUrl)) {
      baseUrl += '/v1';
    }
    const upstream = `${baseUrl}/chat/completions`;

    const payload = {
      model: cfg.model || 'gpt-4o-mini',
      messages: cfg.messages || [],
      temperature: cfg.temperature ?? 0.85,
      max_tokens: cfg.max_tokens ?? 400,
      stream: true,
    };

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 60000);
    let upstreamRes;
    try {
      upstreamRes = await fetch(upstream, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'text/event-stream',
          'User-Agent': 'BlockAcademy/0.1 (local-dev-proxy)',
        },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      return sendJSON(res, 502, { error: `无法连接到 ${upstream}：${e?.message || e}` });
    }

    if (!upstreamRes.ok || !upstreamRes.body) {
      const txt = await upstreamRes.text().catch(() => '');
      clearTimeout(timer);
      let detail = txt;
      try {
        const j = JSON.parse(txt);
        detail = j?.error?.message || JSON.stringify(j);
      } catch {
        /* keep raw text */
      }
      return sendJSON(res, upstreamRes.status, { error: `上游返回 ${upstreamRes.status}：${detail}` });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) res.write(chunk);
        if (res.writableEnded) break;
      }
    } catch {
      /* client aborted */
    } finally {
      clearTimeout(timer);
      try {
        await reader.cancel().catch(() => {});
      } catch {
        /* ignore */
      }
      try {
        res.end();
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    sendJSON(res, 500, { error: `代理内部错误：${e?.message || e}` });
  }
}

export function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

export function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 4_000_000) req.destroy();
    });
    req.on('end', () => resolve(raw));
    req.on('error', () => resolve(''));
  });
}

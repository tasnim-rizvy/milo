// Free-tier LLM providers with automatic failover (docs/02 §4, §9):
// Gemini Flash primary → Groq failover. Both card-free. Streaming responses
// with a first-token budget; any error/timeout silently falls through to the
// next provider, and finally to the scripted bank. The child never waits and
// never sees an error.

export async function* streamGemini({ apiKey, model }, { system, user, maxTokens }, { firstTokenMs, totalMs, signal }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
  };
  yield* sseFetch(url, { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, { firstTokenMs, totalMs, signal }, (obj) => {
    const parts = obj?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((p) => p.text || '').join('');
  });
}

export async function* streamGroq({ apiKey, model }, { system, user, maxTokens }, { firstTokenMs, totalMs, signal }) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const body = {
    model,
    stream: true,
    max_tokens: maxTokens,
    temperature: 0.7,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  yield* sseFetch(url, {
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  }, { firstTokenMs, totalMs, signal }, (obj) => obj?.choices?.[0]?.delta?.content || '');
}

async function* sseFetch(url, init, { firstTokenMs, totalMs, signal }, extract) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const started = Date.now();
  const firstTimer = setTimeout(() => ctrl.abort(new Error('ttft-budget')), firstTokenMs);
  const totalTimer = setTimeout(() => ctrl.abort(new Error('total-budget')), totalMs);

  try {
    const res = await fetch(url, { ...init, method: 'POST', signal: ctrl.signal });
    if (!res.ok || !res.body) throw new Error(`llm-http-${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let gotFirst = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let obj;
        try { obj = JSON.parse(data); } catch { continue; }
        const text = extract(obj);
        if (text) {
          if (!gotFirst) {
            gotFirst = true;
            clearTimeout(firstTimer);
          }
          yield text;
        }
      }
      if (Date.now() - started > totalMs) throw new Error('total-budget');
    }
    if (!gotFirst) throw new Error('empty-stream');
  } finally {
    clearTimeout(firstTimer);
    clearTimeout(totalTimer);
    signal?.removeEventListener('abort', onAbort);
    ctrl.abort();
  }
}

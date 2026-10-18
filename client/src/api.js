// Fetch helpers + SSE stream reader (API contract: docs/02 §6).
const j = async (res) => {
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res.json();
};

export const getChildren = () => fetch('/api/children').then(j);
export const addChild = (nickname, avatar) =>
  fetch('/api/children', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nickname, avatar }),
  }).then(j);
export const removeChild = (key) =>
  fetch(`/api/children/${encodeURIComponent(key)}`, { method: 'DELETE' }).then(j);
export const getHealth = () => fetch('/api/health').then(j);
export const getProgress = (key) => fetch(`/api/progress/${encodeURIComponent(key)}`).then(j);
export const resetDemo = () => fetch('/api/reset-demo', { method: 'POST' }).then(j);

export const startSession = (childKey, intent) =>
  fetch('/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ childKey, intent }),
  }).then(j);

// POST a child input; Milo's reply streams back as SSE frames:
//   event: chunk → { text }   (first words, as soon as available)
//   event: turn  → full turn  (messages, options, effects, dev)
//   event: end   → {}         (stream finished)
export async function sendMessage(sessionId, input, { onChunk, onTurn } = {}) {
  const res = await fetch('/api/message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, input }),
  });
  if (!res.ok || !res.body) throw new Error(`http ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let ev = 'message';
      let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) ev = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data || ev === 'end') continue;
      let obj = null;
      try { obj = JSON.parse(data); } catch { continue; }
      if (ev === 'chunk') onChunk?.(obj);
      else if (ev === 'turn') onTurn?.(obj);
    }
  }
}

// Minimal node:http client for the tool suite.
// Why not fetch? Node's pooled fetch (undici) can stall ~3.4 s on reused
// sockets against our SSE endpoint; core http keeps the same socket at ~65 ms.
// (Browsers manage their own pools and are unaffected — this is tooling only.)
import http from 'node:http';

const BASE = new URL(process.env.E2E_BASE || 'http://localhost:3001');
const HOST = BASE.hostname;
const PORT = Number(BASE.port || 80);
const agent = new http.Agent({ keepAlive: true });

function request(path, { method = 'GET', body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path,
        method,
        agent,
        headers: payload
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, data }));
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export async function getJson(path) {
  const { data } = await request(path);
  return JSON.parse(data);
}

export async function postJson(path, body = {}) {
  const { data } = await request(path, { method: 'POST', body });
  return JSON.parse(data);
}

// POST a child input; returns { ms, turn } — ms is the child-perceived round
// trip (request sent → SSE stream fully received).
export async function sseSend(sessionId, input) {
  const t0 = performance.now();
  const { data } = await request('/api/message', { method: 'POST', body: { sessionId, input } });
  const ms = performance.now() - t0;
  let turn = null;
  for (const frame of data.split('\n\n')) {
    if (!frame.startsWith('event: turn')) continue;
    const line = frame.split('\n').find((l) => l.startsWith('data:'));
    if (line) turn = JSON.parse(line.slice(5));
  }
  return { ms, turn };
}

// Like sseSend, but also records the first streamed token (`ttft`): the moment
// the child first sees words. Falls back to the full round trip when the
// scripted safety net served (no chunks), because then the whole turn is the
// first content.
export async function sseSendTimed(sessionId, input) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const payload = JSON.stringify({ sessionId, input });
    const req = http.request(
      {
        host: HOST, port: PORT, path: '/api/message', method: 'POST', agent,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
      },
      (res) => {
        let data = '';
        let first = null;
        res.setEncoding('utf8');
        res.on('data', (c) => {
          data += c;
          if (first === null && data.includes('event: chunk')) first = performance.now() - t0;
        });
        res.on('end', () => {
          let turn = null;
          for (const frame of data.split('\n\n')) {
            if (!frame.startsWith('event: turn')) continue;
            const line = frame.split('\n').find((l) => l.startsWith('data:'));
            if (line) turn = JSON.parse(line.slice(5));
          }
          const ms = performance.now() - t0;
          resolve({ ms, ttft: first === null ? ms : first, turn });
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

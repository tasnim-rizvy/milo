import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || '0.0.0.0',
  // Demo fixtures (Maya/Aarav) exist only for the evidence tools — never for real users.
  seedDemo: process.env.MILO_DEMO === '1',
  rootDir,
  dbPath: process.env.DB_PATH || join(rootDir, 'server', 'data', 'milo.db'),
  clientDist: join(rootDir, 'client', 'dist'),

  // Free-tier LLM providers — both optional. With no keys, Milo runs fully on
  // the scripted fast-path (the hybrid design guarantees this: pedagogy is
  // deterministic, warmth is generative — and the scripted bank never dies).
  gemini: {
    key: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  },
  groq: {
    key: process.env.GROQ_API_KEY || '',
    // Llama models left Groq's free tier in Aug 2026 — GPT-OSS is the
    // current card-free default. Override with GROQ_MODEL anytime.
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  },
  llm: {
    // First-token budget: if a provider hasn't produced a token by then, the
    // next provider is tried; if none make it, the scripted line plays (≤1.2 s).
    ttftBudgetMs: Number(process.env.LLM_TTFT_BUDGET_MS || 1200),
    totalBudgetMs: Number(process.env.LLM_TOTAL_BUDGET_MS || 2500),
    // Enough headroom for GPT-OSS hidden reasoning + one short child-friendly
    // reply; a stream cut by this budget is detected and replaced (providers.js).
    maxTokens: Number(process.env.LLM_MAX_TOKENS || 220),
    // Optional provider order override, e.g. LLM_PRIORITY=groq,gemini — for
    // networks where one provider answers far faster than the other.
    priority: (process.env.LLM_PRIORITY || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  idleNudgeMs: 45000,
};

export function llmProviders() {
  const all = [
    config.gemini.key && {
      name: 'gemini',
      apiKey: config.gemini.key,
      model: config.gemini.model,
      kind: 'gemini',
    },
    config.groq.key && {
      name: 'groq',
      apiKey: config.groq.key,
      model: config.groq.model,
      kind: 'groq',
    },
  ].filter(Boolean);
  if (!config.llm.priority.length) return all;
  const rank = (p) => {
    const i = config.llm.priority.indexOf(p.name);
    return i === -1 ? 99 : i;
  };
  return [...all].sort((a, b) => rank(a) - rank(b));
}

export function llmEnabled() {
  return llmProviders().length > 0;
}

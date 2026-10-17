import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || '0.0.0.0',
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
    maxTokens: 160,
  },

  idleNudgeMs: 45000,
};

export function llmProviders() {
  return [
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
}

export function llmEnabled() {
  return llmProviders().length > 0;
}

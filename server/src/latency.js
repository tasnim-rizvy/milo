// Per-turn latency instrumentation (doc 02 §3): the 8 timestamps.
// Server-side marks: recv → mode → plan → (llm_first_token) → safety → stream_first → complete.
// The 8th (t_send) is measured client-side; the badge shows the child-perceived total.
export function createTimer() {
  const t0 = process.hrtime.bigint();
  const marks = {};
  const now = () => Math.round((Number(process.hrtime.bigint() - t0) / 1e6) * 10) / 10;
  return {
    mark(name) {
      marks[name] = now();
      return marks[name];
    },
    all() {
      return { ...marks };
    },
  };
}

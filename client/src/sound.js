// Tiny WebAudio earcons (docs/04 §6): soft, optional, never speech.
// All sounds are synthesised — no audio files, no microphone, ever.
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('milo-muted') === '1'; } catch { /* private mode */ }

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', vol = 0.05) {
  const c = ac();
  if (c.state === 'suspended') c.resume().catch(() => {});
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sound = {
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    try { localStorage.setItem('milo-muted', muted ? '1' : '0'); } catch { /* noop */ }
    return muted;
  },
  tap() { if (!muted) try { tone(520, 0, 0.09, 'triangle', 0.04); } catch { /* noop */ } },
  correct() { if (!muted) try { tone(660, 0, 0.1, 'triangle', 0.05); tone(880, 0.09, 0.14, 'triangle', 0.05); } catch { /* noop */ } },
  star() { if (!muted) try { tone(660, 0, 0.09); tone(880, 0.08, 0.09); tone(1100, 0.16, 0.18); } catch { /* noop */ } },
  calm() { if (!muted) try { tone(392, 0, 0.5, 'sine', 0.03); } catch { /* noop */ } },
};

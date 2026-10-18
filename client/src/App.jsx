import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addChild, getChildren, getProgress, removeChild, resetDemo, startSession, sendMessage } from './api.js';
import { sound } from './sound.js';
import Home from './components/Home.jsx';
import ChatView from './components/ChatView.jsx';
import Confetti from './components/Confetti.jsx';
import BadgePop from './components/BadgePop.jsx';
import StickerBook from './components/StickerBook.jsx';
import KidProfiles from './components/KidProfiles.jsx';
import DevPanel from './components/DevPanel.jsx';

const IDLE_MS = 45000;
const rid = () => Math.random().toString(36).slice(2, 8);

export default function App() {
  const devOn = useMemo(() => new URLSearchParams(location.search).get('dev') === '1', []);

  const [children, setChildren] = useState([]);
  const [childKey, setChildKey] = useState(() => {
    try { return localStorage.getItem('milo-child') || 'maya'; } catch { return 'maya'; }
  });
  const [screen, setScreen] = useState('home');
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [options, setOptions] = useState(null);
  const [wordChips, setWordChips] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [mode, setMode] = useState('learning');
  const [stars, setStars] = useState(0);
  const [calm, setCalm] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [badgePop, setBadgePop] = useState(null);
  const [endCard, setEndCard] = useState(null);
  const [latSamples, setLatSamples] = useState([]);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [badges, setBadges] = useState([]);
  const [dev, setDev] = useState(null);
  const [muted, setMuted] = useState(sound.muted);

  const busyRef = useRef(false);
  const sessionRef = useRef(null);
  const endCardRef = useRef(null);
  const lastActivity = useRef(Date.now());
  const lastNudge = useRef(0);

  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => { sessionRef.current = sessionId; }, [sessionId]);
  useEffect(() => { endCardRef.current = endCard; }, [endCard]);

  const reloadChildren = useCallback(() => {
    getChildren().then((d) => setChildren(d.children || [])).catch(() => {});
  }, []);
  useEffect(() => { reloadChildren(); }, [reloadChildren]);

  const child = children.find((c) => c.key === childKey) || null;
  const touch = useCallback(() => { lastActivity.current = Date.now(); }, []);

  const appendMilo = useCallback((msgs) => {
    setMessages((m) => [
      ...m,
      ...msgs.map((x) => ({ id: `m-${Date.now()}-${rid()}`, who: 'milo', text: x.say, mood: x.mood })),
    ]);
  }, []);

  const applyTurn = useCallback((turn, latencyMs) => {
    if (turn.messages && turn.messages.length) appendMilo(turn.messages);
    setOptions(turn.options || null);
    setWordChips(turn.wordChips || null);
    if (turn.mode) setMode(turn.mode);
    const e = turn.effects || {};
    if (typeof e.totalStars === 'number') setStars(e.totalStars);
    if (e.starGain > 0) sound.star();
    if (e.confetti) setConfettiKey((k) => k + 1);
    if (e.badge) setBadgePop(e.badge);
    if (e.endCard) setEndCard(e.endCard);
    if (e.calm) sound.calm();
    setCalm(turn.mode === 'support' || !!e.calm);
    if (typeof latencyMs === 'number') setLatSamples((s) => [...s.slice(-29), latencyMs]);
    if (devOn) {
      setDev(turn.dev || null);
      // e2e/dev hook (docs/06 §5): what the engine expects this turn.
      window.__milo = {
        n: (window.__milo?.n || 0) + 1,
        expect: turn.expect || null,
        options: turn.options || null,
        wordChips: turn.wordChips || null,
        mode: turn.mode,
        phase: turn.dev?.phase || null,
        stars: turn.effects?.totalStars ?? 0,
        endCard: !!turn.effects?.endCard,
        msgs: (turn.messages || []).map((m) => m.say),
      };
    }
  }, [appendMilo, devOn]);

  const sendInput = useCallback(async (payload, echoText) => {
    if (busyRef.current || !sessionRef.current || endCardRef.current) return;
    touch();
    if (echoText) setMessages((m) => [...m, { id: `c-${Date.now()}-${rid()}`, who: 'child', text: echoText }]);
    setOptions(null);
    setWordChips(null);
    setBusy(true);
    setTyping(true);
    setStreamText('');
    sound.tap();
    const t0 = performance.now();
    try {
      await sendMessage(sessionRef.current, payload, {
        onChunk: ({ text }) => {
          if (text) { setTyping(false); setStreamText((s) => (s + text).slice(-400)); }
        },
        onTurn: (turn) => {
          setTyping(false);
          setStreamText('');
          applyTurn(turn, performance.now() - t0);
        },
      });
    } catch {
      setTyping(false);
      setStreamText('');
      appendMilo([{ say: 'Oops — Milo tripped over a cable! Let’s try again. 🦊', mood: 'care' }]);
    } finally {
      setBusy(false);
      touch();
    }
  }, [appendMilo, applyTurn, touch]);

  // Idle nudge (docs/03 §4): after 45s of no child action, once, then the
  // server-side cascade takes over on subsequent idles.
  useEffect(() => {
    const iv = setInterval(() => {
      if (screen !== 'chat' || busyRef.current || endCardRef.current) return;
      const t = Date.now();
      if (t - lastActivity.current < IDLE_MS || t - lastNudge.current < IDLE_MS) return;
      lastNudge.current = t;
      sendInput({ type: 'idle' });
    }, 3000);
    return () => clearInterval(iv);
  }, [screen, sendInput]);

  const start = useCallback(async (intent) => {
    if (busyRef.current) return;
    sound.tap();
    try {
      const r = await startSession(childKey, intent);
      setSessionId(r.sessionId);
      setMessages([]);
      setOptions(null);
      setWordChips(null);
      setInput('');
      setEndCard(null);
      setStars(0);
      setLatSamples([]);
      setBadgePop(null);
      setCalm(intent === 'calm');
      setMode(intent === 'calm' ? 'support' : 'learning');
      setStreamText('');
      setTyping(false);
      applyTurn(r.turn);
      setScreen('chat');
      touch();
      lastNudge.current = 0;
    } catch {
      window.alert('Milo could not wake up 😴 — please make sure the server is running.');
    }
  }, [applyTurn, childKey, touch]);

  const onChip = useCallback((chip) => {
    if (chip.kind === 'word') {
      setInput((v) => (v ? `${v} ${chip.label}` : chip.label));
      sound.tap();
      return;
    }
    const label = `${chip.emoji || ''} ${chip.label || ''}`.trim();
    if (chip.kind === 'reply' && chip.text) return sendInput({ type: 'text', text: chip.text }, label);
    return sendInput({ type: 'chip', chipId: chip.id }, label);
  }, [sendInput]);

  const onSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    return sendInput({ type: 'text', text }, text);
  }, [input, sendInput]);

  const onExit = useCallback(() => { sendInput({ type: 'text', text: 'bye' }, '👋 bye'); }, [sendInput]);

  const goHome = useCallback(() => {
    sound.tap();
    setScreen('home');
    setSessionId(null);
    sessionRef.current = null;
    setMessages([]);
    setOptions(null);
    setWordChips(null);
    setInput('');
    setEndCard(null);
    setCalm(false);
    setStars(0);
    setTyping(false);
    setStreamText('');
    reloadChildren();
  }, [reloadChildren]);

  const openStickers = useCallback(async () => {
    sound.tap();
    try {
      const p = await getProgress(childKey);
      setBadges(p.badges || []);
    } catch { setBadges([]); }
    setStickersOpen(true);
  }, [childKey]);

  const switchChild = useCallback((key) => {
    sound.tap();
    setChildKey(key);
    try { localStorage.setItem('milo-child', key); } catch { /* noop */ }
  }, []);

  // Kid-profiles corner: create / remove kid profiles (progress rows appear
  // lazily; each kid carries their own words, level and star total).
  const openProfiles = useCallback(() => { sound.tap(); setProfilesOpen(true); }, []);

  const makeKid = useCallback(async ({ nickname, avatar }) => {
    const r = await addChild(nickname, avatar);
    reloadChildren();
    switchChild(r.child.key);
    return r;
  }, [reloadChildren, switchChild]);

  const dropKid = useCallback(async (key) => {
    await removeChild(key);
    const d = await getChildren();
    const rest = d.children || [];
    setChildren(rest);
    if (key === childKey && rest[0]) switchChild(rest[0].key);
  }, [childKey, switchChild]);

  const lat = useMemo(() => {
    if (!latSamples.length) return null;
    const s = [...latSamples].sort((a, b) => a - b);
    return { last: latSamples[latSamples.length - 1], p50: s[Math.floor(s.length / 2)] };
  }, [latSamples]);

  return (
    <div className={`app ${calm ? 'is-calm' : ''}${screen !== 'home' ? ' is-chat' : ''}`}>
      {screen === 'home' ? (
        <Home
          child={child}
          childKey={childKey}
          childrenList={children}
          onStart={start}
          onSwitch={switchChild}
          onStickers={openStickers}
          onProfiles={openProfiles}
          muted={muted}
          onToggleMute={() => setMuted(sound.toggle())}
        />
      ) : (
        <ChatView
          child={child}
          calm={calm}
          mode={mode}
          stars={stars}
          latency={lat}
          messages={messages}
          typing={typing}
          streamText={streamText}
          options={options}
          wordChips={wordChips}
          input={input}
          setInput={setInput}
          onSend={onSend}
          onChip={onChip}
          onExit={onExit}
          endCard={endCard}
          onPlayAgain={goHome}
          busy={busy}
          onStickers={openStickers}
          muted={muted}
          onToggleMute={() => setMuted(sound.toggle())}
        />
      )}
      {confettiKey > 0 && <Confetti key={confettiKey} />}
      {badgePop && <BadgePop badge={badgePop} onDone={() => setBadgePop(null)} />}
      {stickersOpen && (
        <StickerBook badges={badges} child={child} onClose={() => { sound.tap(); setStickersOpen(false); }} />
      )}
      {profilesOpen && (
        <KidProfiles
          childrenList={children}
          childKey={childKey}
          onSwitch={switchChild}
          onAdd={makeKid}
          onRemove={dropKid}
          onClose={() => { setProfilesOpen(false); }}
        />
      )}
      {devOn && (
        <DevPanel
          dev={dev}
          child={child}
          lat={lat}
          onReset={async () => { await resetDemo(); goHome(); }}
        />
      )}
    </div>
  );
}

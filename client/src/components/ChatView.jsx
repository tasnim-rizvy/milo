import { useEffect, useMemo, useRef } from 'react';
import CalmBackdrop from './CalmBackdrop.jsx';

const MOOD_FACE = { happy: '😊', cheer: '🤗', care: '💛', calm: '🫧', celebrate: '🎉', think: '🤔' };
const MODES = {
  learning: ['🎓', 'Learning', 'mode-learn'],
  conversation: ['💬', 'Talk', 'mode-talk'],
  engagement: ['🎮', 'Play', 'mode-play'],
  support: ['🫧', 'Calm', 'mode-calm'],
};

const wordsOf = (endCard) =>
  (endCard?.words || []).map((w) => (typeof w === 'string' ? w : w?.text || '')).filter(Boolean);

export default function ChatView({
  child, calm, mode, stars, latency, messages, typing, streamText, options, wordChips,
  input, setInput, onSend, onChip, onExit, endCard, onPlayAgain, busy,
  onStickers, muted, onToggleMute,
}) {
  const endRef = useRef(null);
  const reduce = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
    [],
  );
  const [emoji, label, cls] = MODES[mode] || MODES.learning;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [messages, typing, streamText, options, endCard, reduce]);

  return (
    <div className="chatview">
      <header className="topbar">
        <div className="topbar-left">
          <span className="stars-pill" title="Your stars">⭐ {stars}</span>
          <span className={`mode-pill ${cls}`}>{emoji} {label}</span>
        </div>
        <div className="topbar-right">
          {latency?.last != null && (
            <span className="lat-pill" title={`Median ${Math.round(latency.p50)} ms`}>
              ⚡ {Math.round(latency.last)}ms
            </span>
          )}
          <button className="icon-btn" aria-label={muted ? 'Unmute sounds' : 'Mute sounds'} onClick={onToggleMute}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="icon-btn" aria-label="My stickers" onClick={onStickers}>🎒</button>
          <button className="icon-btn" aria-label="Say bye to Milo" onClick={onExit}>✕</button>
        </div>
      </header>

      <div className="chat-scroll">
        {messages.map((m) => (m.who === 'milo' ? (
          <div className="row milo" key={m.id}>
            <div className="avatar" aria-hidden="true">
              🦊<span className="mood-dot">{MOOD_FACE[m.mood] || ''}</span>
            </div>
            <div className={`bubble mood-${m.mood || 'happy'}`}>{m.text}</div>
          </div>
        ) : (
          <div className="row child" key={m.id}>
            <div className="bubble child-bubble">{m.text}</div>
          </div>
        )))}

        {typing && (
          <div className="row milo">
            <div className="avatar" aria-hidden="true">🦊</div>
            <div className="bubble typing" aria-label="Milo is thinking">
              <span className="dots"><span /><span /><span /></span>
            </div>
          </div>
        )}
        {streamText && (
          <div className="row milo">
            <div className="avatar" aria-hidden="true">🦊</div>
            <div className="bubble">{streamText}<span className="stream-caret">▍</span></div>
          </div>
        )}

        {endCard && (
          <div className="endcard">
            <div className="endcard-title">Great playing today, {child?.nickname || 'friend'}! 🦊</div>
            <div className="endcard-stars">⭐ {endCard.stars ?? 0} stars today</div>
            {wordsOf(endCard).length > 0 && (
              <div className="endcard-words">
                {wordsOf(endCard).map((w, i) => <span className="endcard-word" key={i}>{w}</span>)}
              </div>
            )}
            <button className="btn-primary" onClick={onPlayAgain}>Back home 🏠</button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {calm && !endCard && (
        <div className="calm-strip"><CalmBackdrop /></div>
      )}

      {!endCard && options && options.length > 0 && (
        <div className="chips">
          {options.map((o) => (
            <button
              key={o.id}
              className={`chip chip-${o.kind || 'answer'}`}
              onClick={() => onChip(o)}
              disabled={busy}
            >
              {o.emoji ? <span aria-hidden="true">{o.emoji}</span> : null}
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}

      {!endCard && wordChips && wordChips.length > 0 && (
        <div className="wordrow">
          <span className="wordrow-hint" aria-hidden="true">🧱</span>
          {wordChips.map((c) => (
            <button key={c.id} className="wordchip" onClick={() => onChip(c)} disabled={busy}>{c.label}</button>
          ))}
        </div>
      )}

      {!endCard && (
        <div className="composer-wrap">
          <form className="composer" onSubmit={(e) => { e.preventDefault(); onSend(); }}>
            <input
              className="composer-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type with Milo…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              enterKeyHint="send"
              aria-label="Type a message"
            />
            <button className="send-btn" type="submit" aria-label="Send" disabled={!input.trim() || busy}>➤</button>
          </form>
        </div>
      )}
    </div>
  );
}

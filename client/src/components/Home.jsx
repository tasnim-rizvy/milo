import ProfileForm from './ProfileForm.jsx';

const TILES = [
  { intent: 'learn', emoji: '🎓', label: 'Learn', sub: 'Words & games', cls: 'tile-learn' },
  { intent: 'talk', emoji: '💬', label: 'Talk', sub: 'Chat with Milo', cls: 'tile-talk' },
  { intent: 'play', emoji: '🎮', label: 'Play', sub: 'Fun games', cls: 'tile-play' },
  { intent: 'calm', emoji: '🫧', label: 'Calm', sub: 'Quiet corner', cls: 'tile-calm' },
];

export default function Home({ child, childKey, childrenList, onStart, onSwitch, onStickers, onProfiles, onCreate, ready, muted, onToggleMute }) {
  const name = child?.nickname || 'friend';
  return (
    <div className="home-wrap">
      <header className="topbar">
        <span className="brand">🦊 Milo</span>
        <div className="topbar-right">
          <button className="icon-btn" aria-label={muted ? 'Unmute sounds' : 'Mute sounds'} onClick={onToggleMute}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>
      {!child ? (
        <main className="home">
          <div className="mascot" aria-hidden="true">🦊</div>
          {ready ? (
            <>
              <div>
                <div className="hello-card">Hi, I'm Milo!</div>
                <div className="hello-sub">Tell me about you, so I can pick the right words.</div>
              </div>
              <div className="welcome-form"><ProfileForm onSubmit={onCreate} /></div>
            </>
          ) : null}
        </main>
      ) : (
      <main className="home">
        <div className="mascot" aria-hidden="true">🦊</div>
        <div>
          <div className="hello-card">Hi {name}! 👋</div>
          <div className="hello-sub">What shall we do today?</div>
        </div>
        <div className="tiles">
          {TILES.map((t) => (
            <button key={t.intent} className={`tile ${t.cls}`} onClick={() => onStart(t.intent)}>
              <span className="tile-emoji" aria-hidden="true">{t.emoji}</span>
              <span className="tile-label">{t.label}</span>
              <span className="tile-sub">{t.sub}</span>
            </button>
          ))}
        </div>
        <div className="home-actions">
          <button className="sticker-btn" onClick={onStickers}>
            🎒 My stickers
            {child?.level ? <span className="level-tag">Level {child.level}</span> : null}
            {child?.total_stars > 0 ? <span className="stars-tag">⭐ {child.total_stars}</span> : null}
          </button>
        </div>
        <button className="profiles-link" onClick={onProfiles}>Kids 👥</button>
      </main>
      )}
    </div>
  );
}

const TILES = [
  { intent: 'learn', emoji: '🎓', label: 'Learn', sub: 'Words & games', cls: 'tile-learn' },
  { intent: 'talk', emoji: '💬', label: 'Talk', sub: 'Chat with Milo', cls: 'tile-talk' },
  { intent: 'play', emoji: '🎮', label: 'Play', sub: 'Fun games', cls: 'tile-play' },
  { intent: 'calm', emoji: '🫧', label: 'Calm', sub: 'Quiet corner', cls: 'tile-calm' },
];

export default function Home({ child, childKey, childrenList, onStart, onSwitch, onStickers, muted, onToggleMute }) {
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
          </button>
        </div>
        {childrenList && childrenList.length > 1 && (
          <div className="switcher">
            <span>Playing as:</span>
            {childrenList.map((c) => (
              <button
                key={c.key}
                className={`switch-chip ${c.key === childKey ? 'active' : ''}`}
                onClick={() => onSwitch(c.key)}
              >
                {c.avatar} {c.nickname}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

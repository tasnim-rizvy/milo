import ProfileForm from './ProfileForm.jsx';

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
        <div className="hello-card">Hi {name}! 👋</div>
        <button className="start-btn" onClick={() => onStart('learn')}>
          <span className="start-play" aria-hidden="true">▶</span> Let's go!
        </button>
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

// "My progress": where the child is on the level path, the words they know, the
// feelings they shared, and stickers that unlock along the way. Everything is
// picture-first so a child can read it; the numbers are there for anyone looking over.
const ago = (ts) => {
  if (!ts) return 'not yet';
  const d = Math.floor((Date.now() - ts) / 86400e3);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

export default function ProgressView({ progress, child, onClose }) {
  const p = progress;
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-label="My progress">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title">My progress 📈</div>
            <div className="sheet-sub">{child?.avatar} {child?.nickname}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!p ? (
          <div className="pg-empty">Play a little and come back! 🦊</div>
        ) : (
          <div className="pg">
            <section className="pg-card">
              <div className="pg-levels" aria-label={`Level ${p.level} of 3`}>
                {[1, 2, 3].map((l) => (
                  <div key={l} className={`pg-lvl ${l < p.level ? 'done' : ''} ${l === p.level ? 'now' : ''}`}>
                    <span className="pg-lvl-dot">{l < p.level ? '✓' : l}</span>
                    <span className="pg-lvl-name">Level {l}</span>
                  </div>
                ))}
              </div>
              {p.level < 3 ? (
                <>
                  <div className="pg-bar" role="progressbar" aria-valuenow={p.toNext} aria-valuemin={0} aria-valuemax={100}>
                    <div className="pg-bar-fill" style={{ width: `${Math.max(4, p.toNext)}%` }} />
                  </div>
                  <div className="pg-note">
                    On the way to Level {p.level + 1} · words {p.next.words.have}/{p.next.words.of} · days played {p.next.days.have}/{p.next.days.of}
                  </div>
                </>
              ) : (
                <div className="pg-note">You reached the top level! 🎉</div>
              )}
            </section>

            <section className="pg-row">
              <div className="pg-stat"><div className="pg-big">⭐ {p.stars}</div><div className="pg-cap">stars</div></div>
              <div className="pg-stat"><div className="pg-big">🔤 {p.words.learned.length}</div><div className="pg-cap">words I know</div></div>
              <div className="pg-stat"><div className="pg-big">📅 {p.played.days}</div><div className="pg-cap">days played</div></div>
            </section>
            <div className="pg-note center">Played {p.played.sessions} {p.played.sessions === 1 ? 'time' : 'times'} · last {ago(p.played.last)}</div>

            <section className="pg-card">
              <div className="pg-h">Words I know</div>
              {p.words.learned.length ? (
                <div className="pg-words">
                  {p.words.learned.map((w) => <span key={w.text} className="pg-word">{w.emoji} {w.text}</span>)}
                </div>
              ) : <div className="pg-note">No words yet — let's learn some! 🌱</div>}
              {p.words.practicing.length > 0 && (
                <>
                  <div className="pg-h sub">Still practicing</div>
                  <div className="pg-words">
                    {p.words.practicing.map((w) => <span key={w.text} className="pg-word dim">{w.emoji} {w.text}</span>)}
                  </div>
                </>
              )}
            </section>

            {p.feelings.length > 0 && (
              <section className="pg-card">
                <div className="pg-h">Feelings I shared</div>
                <div className="pg-words">
                  {p.feelings.map((f) => <span key={f.mood} className="pg-word">{f.emoji} {f.mood} · {f.n}</span>)}
                </div>
              </section>
            )}

            <section className="pg-card">
              <div className="pg-h">Stickers</div>
              <div className="sticker-grid">
                {p.milestones.map((m) => (
                  <div key={m.id} className={`sticker ${m.earned ? 'earned' : 'locked'}`}>
                    <div className="sticker-emoji">{m.earned ? m.emoji : '🔒'}</div>
                    <div className="sticker-name">{m.name}</div>
                    <div className="sticker-desc">{m.earned ? 'Earned!' : m.desc}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

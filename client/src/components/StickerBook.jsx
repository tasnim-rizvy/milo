const META = [
  { key: 'badge-l1', emoji: '🏆', name: 'Word Wizard', desc: 'Say lots of words' },
  { key: 'badge-l2', emoji: '⭐', name: 'Sentence Star', desc: 'Build your own sentences' },
  { key: 'badge-l3', emoji: '💬', name: 'Chat Champion', desc: 'Talk and tell stories' },
];

export default function StickerBook({ badges = [], child, onClose }) {
  const raw = (badges || []).map((b) =>
    String(typeof b === 'string' ? b : b.badge_key || b.key || b.name || b.badge || '').toLowerCase());
  const has = (m) => raw.some((r) => r.includes(m.key) || r.includes(m.name.toLowerCase()));

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-label="Sticker book">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title">Stickers 🎒</div>
            <div className="sheet-sub">{child?.nickname || 'My'} · Level {child?.level ?? 1}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sticker-grid">
          {META.map((m) => (
            <div key={m.key} className={`sticker ${has(m) ? 'earned' : 'locked'}`}>
              <div className="sticker-emoji">{has(m) ? m.emoji : '🔒'}</div>
              <div className="sticker-name">{m.name}</div>
              <div className="sticker-desc">{has(m) ? 'Earned!' : m.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';

export default function DevPanel({ dev, child, lat, onReset }) {
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Collapsed by default: a small corner pill so the child UI (and the
  // composer under it) stays clickable; tap 🛠 to expand.
  if (!open) {
    return (
      <div className="devpanel devpanel-min">
        <button className="dev-btn" onClick={() => setOpen(true)} aria-label="Open dev panel">🛠</button>
      </div>
    );
  }

  return (
    <div className="devpanel">
      <div className="devpanel-head">
        <span>🛠 DEV {child ? `· ${child.nickname} · L${child.level}` : ''}</span>
        <span className="spacer" />
        <button
          className="dev-btn"
          disabled={resetting}
          onClick={async () => {
            setResetting(true);
            try { await onReset(); } finally { setResetting(false); }
          }}
        >
          {resetting ? '…' : 'Reset demo'}
        </button>
        <button className="dev-btn" onClick={() => setOpen(false)}>{'▾'}</button>
      </div>
      {open && (
        <pre>
          {JSON.stringify({
            latency: lat ? { last: Math.round(lat.last), p50: Math.round(lat.p50) } : null,
            turn: dev,
          }, null, 1)}
        </pre>
      )}
    </div>
  );
}

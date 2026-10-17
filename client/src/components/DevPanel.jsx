import { useState } from 'react';

export default function DevPanel({ dev, child, lat, onReset }) {
  const [open, setOpen] = useState(true);
  const [resetting, setResetting] = useState(false);
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
        <button className="dev-btn" onClick={() => setOpen((o) => !o)}>{open ? '▾' : '▴'}</button>
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

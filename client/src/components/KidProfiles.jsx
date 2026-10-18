import { useState } from 'react';
import ProfileForm from './ProfileForm.jsx';

const ago = (ts) => {
  if (!ts) return 'new';
  const days = Math.floor((Date.now() - ts) / 86400e3);
  if (days <= 0) return 'played today';
  if (days === 1) return 'played yesterday';
  return `played ${days} days ago`;
};

// The kid-profiles corner: a tiny math gate keeps kids out, then profiles can
// create or remove kid profiles. Each profile keeps its own words, level and
// stars in the local database — the kid just taps their own name to continue.
export default function KidProfiles({ childrenList = [], childKey, onSwitch, onAdd, onUpdate, onRemove, onClose }) {
  const [gate] = useState(() => ({ a: 3 + Math.floor(Math.random() * 5), b: 2 + Math.floor(Math.random() * 5) }));
  const [answer, setAnswer] = useState('');
  const [passed, setPassed] = useState(false);
  const [gateErr, setGateErr] = useState('');
  const [confirmKey, setConfirmKey] = useState(null);
  const [editKey, setEditKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const tryGate = () => {
    if (Number(answer) === gate.a + gate.b) { setPassed(true); setGateErr(''); }
    else { setGateErr('Not quite — try again 🙈'); setAnswer(''); }
  };

  const remove = async (key) => {
    if (confirmKey !== key) { setConfirmKey(key); return; } // first tap asks "Sure?"
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onRemove(key);
      setConfirmKey(null);
    } catch {
      setError('Could not remove — keep at least one kid.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-label="Kid profiles">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title">{passed ? 'Kids 👧🧒' : 'Kid profiles 🔒'}</div>
            <div className="sheet-sub">
              {passed ? 'Each kid keeps their own words, level and stars.' : 'Solve it to open the kid profiles.'}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!passed ? (
          <div className="gp-gate">
            <div className="gp-q">What is {gate.a} + {gate.b}?</div>
            <div className="gp-row">
              <input
                className="gp-input"
                value={answer}
                inputMode="numeric"
                placeholder="?"
                autoFocus
                onChange={(e) => setAnswer(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && tryGate()}
              />
              <button className="btn-primary" onClick={tryGate}>Enter</button>
            </div>
            {gateErr ? <div className="gp-err">{gateErr}</div> : null}
          </div>
        ) : (
          <div className="gp-list">
            {childrenList.map((c) => (
              <div key={c.key}>
              <div className={`kid-row ${c.key === childKey ? 'current' : ''}`}>
                <div className="kid-ava" aria-hidden="true">{c.avatar || '🦊'}</div>
                <div className="kid-meta">
                  <div className="kid-name">
                    {c.nickname}
                    {c.key === childKey ? ' · playing' : ''}
                  </div>
                  <div className="kid-sub">
                    Level {c.level ?? 1} · ⭐ {c.total_stars || 0} stars · {ago(c.last_seen)}
                  </div>
                </div>
                <button className="kid-btn" onClick={() => { onSwitch(c.key); onClose(); }}>Play</button>
                <button className="kid-btn" onClick={() => { setEditKey(editKey === c.key ? null : c.key); setError(''); }}>Edit</button>
                <button
                  className={`kid-btn danger ${confirmKey === c.key ? 'on' : ''}`}
                  onClick={() => remove(c.key)}
                >
                  {confirmKey === c.key ? 'Sure?' : 'Remove'}
                </button>
              </div>
              {editKey === c.key && (
                <div className="gp-add edit">
                  <div className="gp-add-title">✏️ Edit {c.nickname}</div>
                  <ProfileForm
                    key={c.key}
                    submitLabel="Save changes"
                    initial={{
                      nickname: c.nickname, age: c.age_band, avatar: c.avatar,
                      reads: c.reading_band === 'tap-and-type', interests: c.interests || [],
                    }}
                    onCancel={() => setEditKey(null)}
                    onSubmit={async (data) => { await onUpdate(c.key, data); setEditKey(null); }}
                  />
                </div>
              )}
              </div>
            ))}

            <div className="gp-add">
              <div className="gp-add-title">＋ Add a kid</div>
              <ProfileForm
                submitLabel="Add"
                onSubmit={async (data) => { await onAdd(data); onClose(); }}
              />
            </div>
            {error ? <div className="gp-err">{error}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

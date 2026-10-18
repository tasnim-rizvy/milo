import { useState } from 'react';

export const AVATARS = ['🦊', '🐰', '🐼', '🦁', '🐸', '🐨', '🦄', '🐯'];
const INTERESTS = [
  ['animals', '🐾'], ['dinosaurs', '🦖'], ['cars', '🚗'], ['space', '🚀'], ['music', '🎵'],
  ['drawing', '🎨'], ['cats', '🐱'], ['dogs', '🐶'], ['sports', '⚽'], ['robots', '🤖'],
];

// "Tell Milo about you": the answers set the reading band and the first level;
// after that, real progress (mastery gates) moves the child up.
export default function ProfileForm({ onSubmit, submitLabel = 'Start playing' }) {
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState(null);
  const [avatar, setAvatar] = useState('🦊');
  const [reads, setReads] = useState(null);
  const [interests, setInterests] = useState([]);
  const [lang, setLang] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = nickname.trim() && age && reads !== null && !busy;
  const toggle = (i) => setInterests((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < 3 ? [...s, i] : s));

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit({ nickname: nickname.trim(), age, avatar, reads, interests, home_language: lang.trim() });
    } catch {
      setError('Hmm, that did not work — check your name and try again.');
      setBusy(false);
    }
  };

  return (
    <div className="pf">
      <label className="pf-label">What is your name?</label>
      <input
        className="gp-input"
        value={nickname}
        maxLength={16}
        placeholder="Name"
        onChange={(e) => setNickname(e.target.value)}
      />

      <label className="pf-label">How old are you?</label>
      <div className="pf-row">
        {[4, 5, 6].map((a) => (
          <button key={a} className={`pf-pill big ${age === a ? 'on' : ''}`} onClick={() => setAge(a)}>{a}</button>
        ))}
      </div>

      <label className="pf-label">Pick your friend</label>
      <div className="avatar-pick">
        {AVATARS.map((a) => (
          <button key={a} className={`ava ${a === avatar ? 'on' : ''}`} aria-label={`avatar ${a}`} onClick={() => setAvatar(a)}>{a}</button>
        ))}
      </div>

      <label className="pf-label">Can you read little words?</label>
      <div className="pf-row">
        <button className={`pf-pill ${reads === true ? 'on' : ''}`} onClick={() => setReads(true)}>📖 Yes</button>
        <button className={`pf-pill ${reads === false ? 'on' : ''}`} onClick={() => setReads(false)}>👆 Not yet</button>
      </div>

      <label className="pf-label">What do you love? <span className="pf-hint">(up to 3)</span></label>
      <div className="pf-row wrap">
        {INTERESTS.map(([i, e]) => (
          <button key={i} className={`pf-pill ${interests.includes(i) ? 'on' : ''}`} onClick={() => toggle(i)}>{e} {i}</button>
        ))}
      </div>

      <label className="pf-label">Another language at home? <span className="pf-hint">(optional)</span></label>
      <input className="gp-input" value={lang} maxLength={20} placeholder="e.g. Hindi, Bangla" onChange={(e) => setLang(e.target.value)} />

      {error ? <div className="gp-err">{error}</div> : null}
      <button className="btn-primary pf-go" disabled={!ready} onClick={submit}>{submitLabel}</button>
    </div>
  );
}

import { useEffect } from 'react';

export default function BadgePop({ badge, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="badgepop" role="status" onClick={onDone}>
      <div className="badgepop-card">
        <div className="badgepop-emoji">🏅</div>
        <div className="badgepop-label">NEW BADGE!</div>
        <div className="badgepop-name">{String(badge).toUpperCase()}</div>
      </div>
    </div>
  );
}

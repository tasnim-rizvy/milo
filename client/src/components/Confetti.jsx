import { useEffect, useState } from 'react';

const COLORS = ['#FF8A3D', '#FFC94D', '#5BB8F5', '#58C27D', '#9B6BF2', '#FF9DB1'];

export default function Confetti() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 3000);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((i) => (
        <span
          key={i}
          style={{
            left: `${(i * 97) % 100}%`,
            background: COLORS[i % COLORS.length],
            animationDuration: `${1.6 + ((i * 37) % 100) / 100}s`,
            animationDelay: `${((i * 53) % 40) / 100}s`,
          }}
        />
      ))}
    </div>
  );
}

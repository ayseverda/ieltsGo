import React, { useMemo } from 'react';

interface PlantGrowthProps {
  streak: number; // gün sayısı
  size?: number;  // px
}

// SVG tabanlı, streak ile büyüyen basit bir bitki animasyonu
const PlantGrowth: React.FC<PlantGrowthProps> = ({ streak, size = 160 }) => {
  const level = Math.max(0, Math.min(30, Math.floor(streak)));
  const progress = level / 30; // 0..1

  const style: React.CSSProperties = useMemo(() => ({
    width: size,
    height: size,
    display: 'block'
  }), [size]);

  // Seviyeye göre görünür yaprak sayısı
  const leavesVisible = Math.round(progress * 6); // 0..6
  const hasFlower = progress >= 0.85;

  const leafOpacity = (idx: number) => idx <= leavesVisible ? 1 : 0.08;
  const leafScale = (idx: number) => idx <= leavesVisible ? 1 : 0.9;

  const stemHeight = 40 + Math.round(60 * progress); // 40..100

  const swayDur = 4 - 2 * progress; // 2..4

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 200 200" style={style}>
        <defs>
          <linearGradient id="leaf" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5bd47d" />
            <stop offset="100%" stopColor="#2ca55a" />
          </linearGradient>
          <linearGradient id="stem" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5aaa5a" />
            <stop offset="100%" stopColor="#3e7f3e" />
          </linearGradient>
          <linearGradient id="pot" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c47d3a" />
            <stop offset="100%" stopColor="#8f5524" />
          </linearGradient>
        </defs>

        {/* Pot */}
        <g>
          <rect x="60" y="150" width="80" height="20" rx="8" fill="url(#pot)" />
          <rect x="50" y="140" width="100" height="12" rx="6" fill="#6b4020" opacity="0.8" />
        </g>

        {/* Stem (büyüklüğü streak ile artıyor) */}
        <g style={{ transformOrigin: '100px 140px', animation: `sway ${swayDur}s ease-in-out infinite alternate` as any }}>
          <rect x="96" y={140 - stemHeight} width="8" height={stemHeight} rx="4" fill="url(#stem)" />

          {/* Leaves - 6 adet simetrik */}
          {[1, 2, 3].map((row, i) => {
            const y = 140 - stemHeight + 20 + i * 18;
            const idxLeft = i * 2 + 1;
            const idxRight = i * 2 + 2;
            const scaleL = leafScale(idxLeft);
            const scaleR = leafScale(idxRight);
            return (
              <g key={i}>
                <path
                  d={`M96 ${y} C80 ${y - 6},72 ${y - 10},66 ${y - 2} C72 ${y + 10},86 ${y + 6},96 ${y}`}
                  fill="url(#leaf)"
                  opacity={leafOpacity(idxLeft)}
                  style={{ transformOrigin: `96px ${y}px`, transform: `scale(${scaleL})` }}
                />
                <path
                  d={`M104 ${y} C120 ${y - 6},128 ${y - 10},134 ${y - 2} C128 ${y + 10},114 ${y + 6},104 ${y}`}
                  fill="url(#leaf)"
                  opacity={leafOpacity(idxRight)}
                  style={{ transformOrigin: `104px ${y}px`, transform: `scale(${scaleR})` }}
                />
              </g>
            );
          })}

          {/* Flower */}
          {hasFlower && (
            <g style={{ transformOrigin: '100px 140px', animation: 'bloom 1s ease-out forwards' as any }}>
              <circle cx="100" cy={140 - stemHeight - 6} r="6" fill="#ffd54f" stroke="#f6b200" strokeWidth="2" />
              <circle cx="100" cy={140 - stemHeight - 6} r="2" fill="#ff8a00" />
            </g>
          )}
        </g>

        <style>{`
          @keyframes sway {
            from { transform: rotate(-2deg); }
            to   { transform: rotate(2deg); }
          }
          @keyframes bloom {
            from { transform: scale(0.6); opacity: 0.4; }
            to   { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </svg>

      {/* Streak etiketi */}
      <div style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 12, color: '#666' }}>
        🔥 {Math.max(0, streak)}
      </div>
    </div>
  );
};

export default PlantGrowth;



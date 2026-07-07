import { useTelemetryStore } from '../store';

export function Sparkline({ data: propData, maxAngle = 180, color = "#22d3ee" }: { data?: number[]; maxAngle?: number; color?: string }) {
  const storeData = useTelemetryStore(state => state.angleHistory);
  const data = propData ?? storeData;
  if (!data || data.length === 0) {
    return (
      <div className="h-16 w-full flex items-center justify-center text-[10px] text-slate-600 uppercase tracking-widest font-bold">
        Awaiting Data...
      </div>
    );
  }

  // Draw points over the full width
  const w = 300;
  const h = 50;
  
  // Create path
  const pts = data.map((val, i) => {
    // We map 0 to max data index over the width
    const maxIdx = Math.max(data.length - 1, 1);
    const x = (i / maxIdx) * w; 
    const y = h - (val / maxAngle) * h;
    return `${x},${y}`;
  });

  const polylineStr = pts.join(" ");

  return (
    <div className="relative w-full h-[50px] mt-2">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
        {/* Glow behind line */}
        <polyline
          points={polylineStr}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: "blur(6px)", opacity: 0.4 }}
        />
        {/* Main line */}
        <polyline
          points={polylineStr}
          fill="none"
          stroke="url(#sparkline-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="sparkline-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.1)" />
            <stop offset="50%" stopColor={color} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
      </svg>
      {/* Current point indicator */}
      {data.length > 0 && (
        <div 
          className="absolute w-2 h-2 rounded-full transform -translate-x-1 -translate-y-1"
          style={{
            left: `${w}px`,
            top: `${h - (data[data.length - 1] / maxAngle) * h}px`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}`
          }}
        />
      )}
    </div>
  );
}

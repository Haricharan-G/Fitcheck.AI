import { motion, useSpring, useTransform } from "framer-motion";

interface GoniometerProps {
  currentAngle: number;
  romMin: number;
  romMax: number;
  maxAngle?: number; 
}

export function Goniometer({ currentAngle, romMin, romMax, maxAngle = 180 }: GoniometerProps) {
  const SIZE = 400;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 150;
  const STROKE = 24;

  // Smooth spring for the active progress ring
  const springAngle = useSpring(currentAngle, { stiffness: 90, damping: 20 });
  const arcProgress = useTransform(springAngle, [0, maxAngle], [0, 1]);

  const START_DEG = -120;
  const END_DEG = 120;
  const TOTAL_SWEEP = END_DEG - START_DEG; // 240 degrees

  function degToRad(deg: number) {
    return (deg * Math.PI) / 180;
  }

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = degToRad(angleDeg);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
    const start = polarToCartesian(cx, cy, r, startDeg);
    const end = polarToCartesian(cx, cy, r, endDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  const arcLength = (TOTAL_SWEEP / 360) * 2 * Math.PI * R;
  const strokeDasharray = `${arcLength} ${arcLength}`;
  const strokeDashoffset = useTransform(arcProgress, (p) => arcLength * (1 - p));

  // Visual cues
  const nearDanger = currentAngle > romMax * 0.9 && currentAngle <= romMax;
  const inDanger = currentAngle > romMax;

  // Tonal/WHOOP inspired Colors
  const activeColor = inDanger ? "#f43f5e" : nearDanger ? "#f59e0b" : "#2dd4bf"; // Teal safe
  const shadowColor = inDanger ? "rgba(244, 63, 94, 0.4)" : nearDanger ? "rgba(245, 158, 11, 0.4)" : "rgba(45, 212, 191, 0.4)";

  const TICK_R_INNER = R + 24;
  const TICK_R_OUTER = R + 34;
  const ticks = [];
  for (let i = 0; i <= maxAngle; i += 30) {
    const deg = START_DEG + (i / maxAngle) * TOTAL_SWEEP;
    const inner = polarToCartesian(CX, CY, TICK_R_INNER, deg);
    const outer = polarToCartesian(CX, CY, TICK_R_OUTER, deg);
    
    ticks.push(
      <g key={`tick-${i}`}>
        <line
          x1={inner.x} y1={inner.y}
          x2={outer.x} y2={outer.y}
          stroke={i >= romMin && i <= romMax ? "#2dd4bf" : "#334155"}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <text
          x={polarToCartesian(CX, CY, TICK_R_OUTER + 18, deg).x}
          y={polarToCartesian(CX, CY, TICK_R_OUTER + 18, deg).y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={i >= romMin && i <= romMax ? "#2dd4bf" : "#475569"}
          fontSize="12"
          fontWeight="700"
          fontFamily="Inter, system-ui"
        >
          {i}°
        </text>
      </g>
    );
  }

  // Draw ROM limits underneath
  const safeStartDeg = START_DEG + (romMin / maxAngle) * TOTAL_SWEEP;
  const safeEndDeg = START_DEG + (romMax / maxAngle) * TOTAL_SWEEP;

  return (
    <div className="relative flex items-center justify-center w-full h-full min-h-[300px]">
      <svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
        
        {/* Glow Filters */}
        <defs>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Under-Track (Track background) */}
        <path
          d={describeArc(CX, CY, R, START_DEG, END_DEG)}
          fill="none"
          stroke="#0f172a"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Safe ROM Underlay */}
        <path
          d={describeArc(CX, CY, R, safeStartDeg, safeEndDeg)}
          fill="none"
          stroke="rgba(45, 212, 191, 0.6)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Dynamic Progress Arc */}
        <motion.path
          d={describeArc(CX, CY, R, START_DEG, END_DEG)}
          fill="none"
          stroke={activeColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          style={{ strokeDashoffset }}
          filter="url(#neon-glow)"
        />

        {/* Tick Marks */}
        {ticks}
      </svg>

      {/* Center Digital Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
        <motion.div 
          className="flex items-start text-center"
          animate={{ scale: inDanger ? 1.05 : 1, color: activeColor }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        >
          <span 
            className="text-[100px] leading-none font-black tabular-nums tracking-tighter drop-shadow-2xl"
            style={{ textShadow: `0 0 40px ${shadowColor}` }}
          >
            {Math.round(currentAngle)}
          </span>
          <span className="text-4xl font-black mt-2">°</span>
        </motion.div>
        <span className="text-xs font-bold tracking-[0.3em] uppercase text-slate-500 mt-4">
          Joint Angle
        </span>
      </div>
    </div>
  );
}

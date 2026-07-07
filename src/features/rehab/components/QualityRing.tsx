import { motion, useSpring, useTransform } from "framer-motion";

interface QualityRingProps {
  score: number; // 0..100
  label: string;
  size?: number;
}

export function QualityRing({ score, label, size = 160 }: QualityRingProps) {
  const R = (size - 16) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const CX = size / 2;
  const CY = size / 2;

  const springScore = useSpring(score, { stiffness: 80, damping: 20 });
  const dashOffset = useTransform(springScore, [0, 100], [CIRCUMFERENCE, 0]);

  const color =
    score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  const grade =
    score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "F";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="#1e293b"
            strokeWidth={8}
          />
          {/* Progress */}
          <motion.circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            style={{
              strokeDashoffset: dashOffset,
              filter: `drop-shadow(0 0 8px ${color}60)`,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-black tabular-nums"
            style={{ color }}
          >
            {grade}
          </span>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: `${color}99` }}
          >
            {Math.round(score)}%
          </span>
        </div>
      </div>

      <span className="text-xs font-bold tracking-[0.15em] uppercase text-slate-500">
        {label}
      </span>
    </div>
  );
}

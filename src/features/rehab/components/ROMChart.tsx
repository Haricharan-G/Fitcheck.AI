import { motion } from "framer-motion";
import type { SetResult } from "../types";

interface ROMChartProps {
  sets: SetResult[];
  romMax: number;
}

export function ROMChart({ sets, romMax }: ROMChartProps) {
  if (sets.length === 0) return null;

  const CHART_W = 500;
  const CHART_H = 200;
  const PAD_X = 50;
  const PAD_Y = 30;
  const INNER_W = CHART_W - PAD_X * 2;
  const INNER_H = CHART_H - PAD_Y * 2;

  const maxVal = Math.max(romMax, ...sets.map((s) => s.maxROM)) + 10;
  const minVal = 0;

  function toX(i: number) {
    return PAD_X + (i / Math.max(sets.length - 1, 1)) * INNER_W;
  }

  function toY(val: number) {
    return PAD_Y + INNER_H - ((val - minVal) / (maxVal - minVal)) * INNER_H;
  }

  // Build polyline
  const points = sets.map((s, i) => `${toX(i)},${toY(s.maxROM)}`).join(" ");

  // Build area fill path
  const areaPath = [
    `M ${toX(0)},${toY(sets[0].maxROM)}`,
    ...sets.slice(1).map((s, i) => `L ${toX(i + 1)},${toY(s.maxROM)}`),
    `L ${toX(sets.length - 1)},${PAD_Y + INNER_H}`,
    `L ${toX(0)},${PAD_Y + INNER_H}`,
    "Z",
  ].join(" ");

  // Y-axis grid lines
  const gridLines = [0, 30, 60, 90, 120, 150, 180].filter((v) => v <= maxVal);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-0.5 bg-emerald-400 rounded" />
        <span className="text-xs font-bold tracking-[0.15em] uppercase text-slate-400">
          Max Active ROM — Last {sets.length} Sets
        </span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full"
        style={{ maxHeight: 220 }}
      >
        {/* Grid */}
        {gridLines.map((val) => (
          <g key={val}>
            <line
              x1={PAD_X}
              y1={toY(val)}
              x2={CHART_W - PAD_X}
              y2={toY(val)}
              stroke="#1e293b"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={PAD_X - 8}
              y={toY(val)}
              textAnchor="end"
              dominantBaseline="central"
              fill="#475569"
              fontSize="10"
              fontWeight="600"
              fontFamily="Inter, system-ui"
            >
              {val}°
            </text>
          </g>
        ))}

        {/* Target line */}
        <line
          x1={PAD_X}
          y1={toY(romMax)}
          x2={CHART_W - PAD_X}
          y2={toY(romMax)}
          stroke="#10b981"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          opacity={0.5}
        />
        <text
          x={CHART_W - PAD_X + 6}
          y={toY(romMax)}
          fill="#10b981"
          fontSize="9"
          fontWeight="700"
          dominantBaseline="central"
          fontFamily="Inter, system-ui"
        >
          Goal
        </text>

        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill="url(#rom-gradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />

        {/* Line */}
        <motion.polyline
          points={points}
          fill="none"
          stroke="#10b981"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ filter: "drop-shadow(0 0 6px rgba(16, 185, 129, 0.4))" }}
        />

        {/* Data points */}
        {sets.map((s, i) => (
          <g key={i}>
            <motion.circle
              cx={toX(i)}
              cy={toY(s.maxROM)}
              r={5}
              fill="#0c1222"
              stroke="#10b981"
              strokeWidth={2.5}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 + i * 0.1, type: "spring" }}
              style={{ filter: "drop-shadow(0 0 4px rgba(16, 185, 129, 0.4))" }}
            />
            <text
              x={toX(i)}
              y={toY(s.maxROM) - 14}
              textAnchor="middle"
              fill="#10b981"
              fontSize="10"
              fontWeight="700"
              fontFamily="Inter, system-ui"
            >
              {Math.round(s.maxROM)}°
            </text>
            {/* X-axis labels */}
            <text
              x={toX(i)}
              y={PAD_Y + INNER_H + 18}
              textAnchor="middle"
              fill="#475569"
              fontSize="10"
              fontWeight="600"
              fontFamily="Inter, system-ui"
            >
              Set {s.setNumber}
            </text>
          </g>
        ))}

        {/* Gradient def */}
        <defs>
          <linearGradient id="rom-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

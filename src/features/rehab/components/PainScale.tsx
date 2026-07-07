import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PainScaleProps {
  onSubmit: (rating: number) => void;
}

const PAIN_COLORS = [
  "#10b981", // 1 — mint
  "#34d399", // 2
  "#6ee7b7", // 3
  "#a3e635", // 4
  "#facc15", // 5 — yellow
  "#fbbf24", // 6
  "#f59e0b", // 7 — amber
  "#f97316", // 8
  "#ef4444", // 9 — red
  "#dc2626", // 10 — deep red
];

const PAIN_LABELS = [
  "No pain",
  "Minimal",
  "Mild",
  "Moderate",
  "Distracting",
  "Uncomfortable",
  "Distressing",
  "Unmanageable",
  "Intense",
  "Worst possible",
];

const PAIN_FACES = ["😊", "🙂", "😐", "😟", "😣", "😖", "😫", "😩", "😰", "🤯"];

export function PainScale({ onSubmit }: PainScaleProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (selected !== null) {
      setConfirmed(true);
      setTimeout(() => onSubmit(selected), 600);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(2, 6, 23, 0.92)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative w-full max-w-2xl rounded-3xl border border-slate-800 p-8 md:p-10"
        style={{ backgroundColor: "#0c1222" }}
        initial={{ scale: 0.9, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400">
              Post-Set Assessment
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Rate your pain during this set
          </h2>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            Honest feedback helps your therapist calibrate your recovery protocol.
          </p>
        </div>

        {/* Scale */}
        <div className="grid grid-cols-10 gap-1.5 md:gap-2 mb-6">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
            const isSelected = selected === num;
            const color = PAIN_COLORS[num - 1];

            return (
              <motion.button
                key={num}
                onClick={() => setSelected(num)}
                className="relative flex flex-col items-center gap-1 py-3 md:py-4 rounded-xl border-2 transition-colors cursor-pointer"
                style={{
                  borderColor: isSelected ? color : "#1e293b",
                  backgroundColor: isSelected ? `${color}15` : "#0f172a",
                }}
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.95 }}
                animate={isSelected ? { boxShadow: `0 0 20px ${color}30` } : { boxShadow: "none" }}
              >
                <span className="text-lg md:text-2xl">{PAIN_FACES[num - 1]}</span>
                <span
                  className="text-sm md:text-lg font-black tabular-nums"
                  style={{ color: isSelected ? color : "#64748b" }}
                >
                  {num}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Label */}
        <AnimatePresence mode="wait">
          {selected !== null && (
            <motion.div
              key={selected}
              className="text-center mb-8"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <span
                className="text-lg font-bold"
                style={{ color: PAIN_COLORS[selected - 1] }}
              >
                {PAIN_LABELS[selected - 1]}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <motion.button
          onClick={handleConfirm}
          disabled={selected === null}
          className="w-full py-4 rounded-2xl font-black text-lg uppercase tracking-[0.15em] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            backgroundColor: selected !== null ? PAIN_COLORS[selected - 1] : "#1e293b",
            color: selected !== null && selected <= 5 ? "#0f172a" : "#ffffff",
          }}
          whileHover={selected !== null ? { scale: 1.02 } : {}}
          whileTap={selected !== null ? { scale: 0.98 } : {}}
        >
          {confirmed ? "✓ Recorded" : "Log Pain Level"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

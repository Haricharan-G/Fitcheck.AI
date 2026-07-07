import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ProtocolConfig, SetResult, TelemetryFrame } from "./types";
import { PainScale } from "./components/PainScale";
import { QualityRing } from "./components/QualityRing";
import { ROMChart } from "./components/ROMChart";

interface PostSetAnalyticsProps {
  config: ProtocolConfig;
  telemetryLog: TelemetryFrame[];
  previousSets: SetResult[];
  onNewSet: (result: SetResult) => void;
  onBackToSetup: () => void;
}

export function PostSetAnalytics({
  config,
  telemetryLog,
  previousSets,
  onNewSet,
  onBackToSetup,
}: PostSetAnalyticsProps) {
  const [painRating, setPainRating] = useState<number | null>(null);
  const [showPainModal, setShowPainModal] = useState(true);

  // Compute set metrics from telemetry log
  const setMetrics = useMemo(() => {
    if (telemetryLog.length === 0) {
      return { maxROM: config.romMax * 0.85, minROM: config.romMin, avgTempo: config.targetTempo, tempoAdherence: 0.82, compensationCount: 3 };
    }

    const angles = telemetryLog.map((f) => f.currentAngle);
    const maxROM = Math.max(...angles);
    const minROM = Math.min(...angles);
    const avgTempo = config.targetTempo;
    const tempoAdherence =
      telemetryLog.reduce((sum, f) => sum + f.tempoAdherence, 0) / telemetryLog.length;
    const compensationCount = telemetryLog.filter((f) => f.compensationDetected).length;

    return { maxROM, minROM, avgTempo, tempoAdherence, compensationCount };
  }, [telemetryLog, config]);

  // Quality score: weighted average of tempo adherence and compensation penalty
  const qualityScore = useMemo(() => {
    const tempoScore = setMetrics.tempoAdherence * 100;
    const compPenalty = Math.min(setMetrics.compensationCount * 5, 30);
    return Math.max(0, Math.round(tempoScore - compPenalty));
  }, [setMetrics]);

  // Tempo adherence as a percentage
  const tempoScore = Math.round(setMetrics.tempoAdherence * 100);

  const handlePainSubmit = (rating: number) => {
    setPainRating(rating);
    setShowPainModal(false);

    const result: SetResult = {
      setNumber: previousSets.length + 1,
      maxROM: setMetrics.maxROM,
      minROM: setMetrics.minROM,
      avgTempo: setMetrics.avgTempo,
      tempoAdherence: setMetrics.tempoAdherence,
      compensationCount: setMetrics.compensationCount,
      painRating: rating,
      durationSec: telemetryLog.length > 0
        ? Math.round((telemetryLog[telemetryLog.length - 1].timestamp - telemetryLog[0].timestamp) / 1000)
        : 30,
    };

    onNewSet(result);
  };

  // All sets including current
  const allSets: SetResult[] = [
    ...previousSets,
    ...(painRating !== null
      ? [{
          setNumber: previousSets.length + 1,
          maxROM: setMetrics.maxROM,
          minROM: setMetrics.minROM,
          avgTempo: setMetrics.avgTempo,
          tempoAdherence: setMetrics.tempoAdherence,
          compensationCount: setMetrics.compensationCount,
          painRating,
          durationSec: telemetryLog.length > 0
            ? Math.round((telemetryLog[telemetryLog.length - 1].timestamp - telemetryLog[0].timestamp) / 1000)
            : 30,
        }]
      : []),
  ];

  return (
    <>
      {/* Pain Scale Modal */}
      <AnimatePresence>
        {showPainModal && <PainScale onSubmit={handlePainSubmit} />}
      </AnimatePresence>

      {/* Analytics Dashboard */}
      <AnimatePresence>
        {!showPainModal && (
          <motion.div
            className="min-h-screen p-6 md:p-8 bg-black relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="max-w-5xl mx-auto relative z-10">
              {/* Header */}
              <motion.div
                className="mb-10"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-500/5 mb-4 shadow-[0_0_15px_rgba(45,212,191,0.1)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                      <span className="text-[9px] font-black tracking-[0.2em] uppercase text-teal-400">
                        Set Complete
                      </span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter">
                      Session Analytics
                    </h1>
                    <p className="text-sm text-white/40 font-bold mt-2 tracking-wide uppercase">
                      {config.jointLabel} — Set #{previousSets.length + 1}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <motion.button
                      onClick={onBackToSetup}
                      className="px-6 py-3 rounded-2xl border border-white/10 bg-white/5 text-white/70 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 hover:text-white transition-all cursor-pointer backdrop-blur-md shadow-lg"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      New Protocol
                    </motion.button>
                  </div>
                </div>
              </motion.div>

              {/* Key Metrics Row */}
              <motion.div
                className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                {[
                  { label: "Max ROM", value: `${Math.round(setMetrics.maxROM)}°`, color: "#2dd4bf" },
                  { label: "Pain Rating", value: painRating !== null ? `${painRating}/10` : "—", color: painRating && painRating > 6 ? "#f43f5e" : "#f59e0b" },
                  { label: "Compensations", value: `${setMetrics.compensationCount}`, color: setMetrics.compensationCount > 3 ? "#f59e0b" : "#2dd4bf" },
                  { label: "Duration", value: telemetryLog.length > 0
                    ? `${Math.round((telemetryLog[telemetryLog.length - 1].timestamp - telemetryLog[0].timestamp) / 1000)}s`
                    : "30s", color: "#94a3b8" },
                ].map((metric, i) => (
                  <motion.div
                    key={metric.label}
                    className="rounded-[2rem] border border-white/5 p-6 backdrop-blur-xl bg-[#050505]/80 shadow-2xl relative overflow-hidden"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/40 block mb-2">
                      {metric.label}
                    </span>
                    <span
                      className="text-4xl font-black tabular-nums tracking-tighter"
                      style={{ color: metric.color }}
                    >
                      {metric.value}
                    </span>
                  </motion.div>
                ))}
              </motion.div>

              {/* Chart + Quality Rings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ROM Chart */}
                <motion.div
                  className="md:col-span-2 rounded-[2rem] border border-white/5 p-8 backdrop-blur-xl bg-[#050505]/80 shadow-2xl"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {allSets.length > 0 ? (
                    <ROMChart sets={allSets} romMax={config.romMax} />
                  ) : (
                    <div className="h-48 flex items-center justify-center text-white/30 text-sm font-bold tracking-widest uppercase">
                      Complete more sets to see trends
                    </div>
                  )}
                </motion.div>

                {/* Quality Rings */}
                <motion.div
                  className="rounded-[2rem] border border-white/5 p-8 flex flex-col items-center justify-center gap-10 backdrop-blur-xl bg-[#050505]/80 shadow-2xl relative overflow-hidden"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.35 }}
                >
                  <div className="absolute inset-0 bg-teal-500/5 mix-blend-screen pointer-events-none" />
                  <QualityRing score={qualityScore} label="Overall Quality" size={160} />
                  <QualityRing score={tempoScore} label="Tempo Score" size={120} />
                </motion.div>
              </div>

              {/* Set History Table */}
              {allSets.length > 0 && (
                <motion.div
                  className="mt-6 rounded-[2rem] border border-white/5 overflow-hidden backdrop-blur-xl bg-[#050505]/80 shadow-2xl"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="px-8 py-5 border-b border-white/5 bg-white/[0.02]">
                    <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white/40">
                      Set History
                    </span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-[9px] font-black tracking-[0.2em] uppercase text-white/30 border-b border-white/5">
                        <th className="px-8 py-4 text-left">Set</th>
                        <th className="px-8 py-4 text-right">Max ROM</th>
                        <th className="px-8 py-4 text-right">Tempo Flow</th>
                        <th className="px-8 py-4 text-right">Comp.</th>
                        <th className="px-8 py-4 text-right">Pain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSets.map((s) => (
                        <tr
                          key={s.setNumber}
                          className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-8 py-4 text-sm font-bold text-white/70">
                            #{s.setNumber}
                          </td>
                          <td className="px-8 py-4 text-sm font-black text-teal-400 text-right tabular-nums">
                            {Math.round(s.maxROM)}°
                          </td>
                          <td className="px-8 py-4 text-sm font-black text-right tabular-nums"
                            style={{
                              color: s.tempoAdherence > 0.8 ? "#2dd4bf" : s.tempoAdherence > 0.5 ? "#f59e0b" : "#f43f5e"
                            }}
                          >
                            {Math.round(s.tempoAdherence * 100)}%
                          </td>
                          <td className="px-8 py-4 text-sm font-black text-right tabular-nums"
                            style={{ color: s.compensationCount > 3 ? "#f59e0b" : "#94a3b8" }}
                          >
                            {s.compensationCount}
                          </td>
                          <td className="px-8 py-4 text-sm font-black text-right tabular-nums"
                            style={{ color: s.painRating && s.painRating > 6 ? "#f43f5e" : "#f59e0b" }}
                          >
                            {s.painRating ?? "—"}/10
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { JOINT_PROTOCOLS, type ProtocolConfig } from "./types";

interface ProtocolSetupProps {
  onStart: (config: ProtocolConfig) => void;
}

export function ProtocolSetup({ onStart }: ProtocolSetupProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<string>(JOINT_PROTOCOLS[0].id);
  const [romMin, setRomMin] = useState<number>(JOINT_PROTOCOLS[0].defaultMin);
  const [romMax, setRomMax] = useState<number>(JOINT_PROTOCOLS[0].defaultMax);
  const [targetTempo, setTargetTempo] = useState<number>(3);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const currentProtocol = useMemo(
    () => JOINT_PROTOCOLS.find((p) => p.id === selectedProtocol)!,
    [selectedProtocol]
  );

  const handleProtocolChange = (id: string) => {
    const proto = JOINT_PROTOCOLS.find((p) => p.id === id)!;
    setSelectedProtocol(id);
    setRomMin(proto.defaultMin);
    setRomMax(proto.defaultMax);
    setIsDropdownOpen(false);
  };

  const handleStart = () => {
    onStart({
      jointProtocol: selectedProtocol,
      jointLabel: currentProtocol.label,
      romMin,
      romMax,
      targetTempo,
    });
  };

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center p-6 relative bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.5 }}
    >
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Navigation */}
      <div className="absolute top-6 left-6 z-50">
        <Link 
          to="/" 
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/[0.02] text-white/40 hover:text-white hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300 backdrop-blur-md"
        >
          <ArrowLeft size={16} />
          <span className="text-xs font-bold tracking-widest uppercase">Menu</span>
        </Link>
      </div>

      <div className="w-full max-w-xl relative z-10">
        {/* Branding header */}
        <motion.div
          className="text-center mb-10"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-teal-500/20 bg-teal-500/5 mb-5 shadow-[0_0_15px_rgba(45,212,191,0.1)]">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-teal-400">
              Clinical Protocol
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-2">
            Rehab Setup
          </h1>
          <p className="text-white/40 text-sm max-w-sm mx-auto font-medium">
            Configure your physical therapy session parameters below.
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="rounded-[2rem] border border-white/5 p-8 md:p-10 relative overflow-hidden backdrop-blur-3xl bg-[#050505]/80 shadow-2xl"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
        >
          {/* Subtle card glow */}
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>

          {/* Protocol Selector */}
          <div className="mb-8 relative z-50">
            <label className="block text-[9px] font-black tracking-[0.2em] uppercase text-white/40 mb-3">
              Target Joint & Protocol
            </label>
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-white/5 bg-black text-left hover:border-teal-500/30 transition-all cursor-pointer shadow-inner"
              >
                <div>
                  <span className="text-white font-bold text-base tracking-wide">
                    {currentProtocol.label}
                  </span>
                  <span className="block text-[10px] uppercase tracking-wider text-white/30 mt-1">
                    Default range: {currentProtocol.defaultMin}° – {currentProtocol.defaultMax}°
                  </span>
                </div>
                <motion.span
                  className="text-white/30 text-xl"
                  animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                >
                  ▾
                </motion.span>
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    className="absolute z-30 top-full left-0 right-0 mt-2 rounded-2xl border border-white/10 overflow-y-auto max-h-[40vh] bg-[#0a0a0a] shadow-2xl backdrop-blur-xl"
                    initial={{ opacity: 0, y: -8, scaleY: 0.9 }}
                    animate={{ opacity: 1, y: 0, scaleY: 1 }}
                    exit={{ opacity: 0, y: -8, scaleY: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    {JOINT_PROTOCOLS.map((proto) => (
                      <button
                         key={proto.id}
                         onClick={() => handleProtocolChange(proto.id)}
                         className={`w-full text-left px-5 py-4 border-b border-white/5 last:border-b-0 transition-all cursor-pointer ${
                           proto.id === selectedProtocol
                             ? "bg-teal-500/10 text-teal-400"
                             : "text-white/60 hover:bg-white/5"
                         }`}
                       >
                         <span className="font-bold text-sm tracking-wide">{proto.label}</span>
                         <span className="block text-[10px] uppercase tracking-wider text-white/30 mt-1">
                           {proto.defaultMin}° – {proto.defaultMax}°
                         </span>
                       </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ROM Range */}
          <div className="mb-8 relative z-10">
            <label className="block text-[9px] font-black tracking-[0.2em] uppercase text-white/40 mb-3">
              Safe ROM Limits
            </label>

            {/* Visual range indicator */}
            <div className="relative h-2 rounded-full bg-black border border-white/5 mb-6 overflow-hidden shadow-inner">
              <div
                className="absolute inset-y-0 rounded-full"
                style={{
                  left: `${(romMin / 180) * 100}%`,
                  width: `${((romMax - romMin) / 180) * 100}%`,
                  background: "linear-gradient(90deg, #2dd4bf, #0d9488)",
                  boxShadow: "0 0 15px rgba(45, 212, 191, 0.4)",
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/50 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Min Safe</span>
                  <span className="text-sm font-black text-teal-400 tabular-nums">
                    {romMin}°
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={romMax - 5}
                  value={romMin}
                  onChange={(e) => setRomMin(Number(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer"
                />
              </div>
              <div className="bg-black/50 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Max Safe</span>
                  <span className="text-sm font-black text-teal-400 tabular-nums">
                    {romMax}°
                  </span>
                </div>
                <input
                  type="range"
                  min={romMin + 5}
                  max={180}
                  value={romMax}
                  onChange={(e) => setRomMax(Number(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Tempo */}
          <div className="mb-10 relative z-10">
            <label className="block text-[9px] font-black tracking-[0.2em] uppercase text-white/40 mb-3">
              Target Tempo Flow
            </label>
            <div className="flex items-center gap-6 bg-black/50 p-5 rounded-2xl border border-white/5">
              <input
                type="range"
                min={1}
                max={8}
                step={0.5}
                value={targetTempo}
                onChange={(e) => setTargetTempo(Number(e.target.value))}
                className="flex-1 accent-teal-400 cursor-pointer"
              />
              <div className="flex items-baseline gap-1.5 min-w-[70px] justify-end">
                <span className="text-3xl font-black text-white tabular-nums tracking-tighter">
                  {targetTempo}
                </span>
                <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">sec/ph</span>
              </div>
            </div>
          </div>

          {/* Start button */}
          <motion.button
            onClick={handleStart}
            className="relative z-10 w-full py-5 rounded-2xl bg-teal-500 hover:bg-teal-400 text-black font-black text-sm uppercase tracking-[0.2em] transition-all cursor-pointer overflow-hidden group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              boxShadow: "0 0 40px rgba(45, 212, 191, 0.15), 0 4px 20px rgba(45, 212, 191, 0.1)",
            }}
          >
            {/* Button highlight sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            <span className="relative z-10">Initialize Protocol</span>
          </motion.button>
        </motion.div>

        {/* Footer */}
        <div className="flex justify-center items-center gap-2 mt-8">
           <div className="w-1.5 h-1.5 rounded-full bg-teal-400/50" />
           <p className="text-center text-[9px] font-black text-white/30 tracking-[0.3em] uppercase">
             FormCheck Rehab Engine
           </p>
        </div>
      </div>
    </motion.div>
  );
}

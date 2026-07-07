import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Clock, Target, Info, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { type ExerciseConfig } from "../poseEngine";

interface ExerciseDetailModalProps {
  exercise: ExerciseConfig | null;
  onClose: () => void;
}

export function ExerciseDetailModal({ exercise, onClose }: ExerciseDetailModalProps) {
  if (!exercise) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl bg-[#0a0a0a] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative"
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>

          {/* Left: Image & Quick Stats */}
          <div className="w-full md:w-5/12 relative min-h-[250px] md:min-h-full bg-surface-accent">
            {exercise.demoUrl && (
              <>
                <img
                  src={exercise.demoUrl}
                  alt={`${exercise.name} preview`}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (!target.dataset.fallbackApplied) {
                      target.dataset.fallbackApplied = "true";
                      target.src = "https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=1470&auto=format&fit=crop";
                    } else {
                      target.style.display = "none";
                    }
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#0a0a0a]" />
              </>
            )}
            
            <div className="absolute inset-0 p-8 flex flex-col justify-between z-10">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.05] backdrop-blur-md border border-white/10 flex items-center justify-center text-4xl shadow-xl">
                {exercise.emoji}
              </div>

              <div className="flex gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  exercise.difficulty === 'beginner' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  exercise.difficulty === 'intermediate' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {exercise.difficulty}
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/[0.05] text-slate-400 border border-white/[0.06] backdrop-blur-md">
                  <Clock size={12} />
                  {exercise.estimatedMinutes}m
                </span>
              </div>
            </div>
          </div>

          {/* Right: Details & Actions */}
          <div className="w-full md:w-7/12 p-8 md:p-10 flex flex-col">
            <div className="mb-8">
              <h2 className="text-3xl font-extrabold text-white mb-2">{exercise.name}</h2>
              <p className="text-slate-400 text-sm">{exercise.target}</p>
            </div>

            <div className="space-y-8 flex-1">
              
              {/* Target Muscles */}
              <div>
                <h3 className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">
                  <Target size={14} /> Target Muscles
                </h3>
                <div className="flex flex-wrap gap-2">
                  {exercise.muscles.map((m: string) => (
                    <span key={m} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-slate-300 font-medium">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div>
                <h3 className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">
                  <Info size={14} /> Form Instructions
                </h3>
                <ul className="space-y-3">
                  {exercise.instructions.map((step: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                      <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Actions */}
            <div className="mt-8 pt-8 border-t border-white/[0.06]">
              <Link
                to={`/tracker?exercise=${exercise.id}`}
                className="w-full py-4 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-bold text-sm tracking-widest uppercase rounded-xl flex items-center justify-center gap-2 shadow-[0_0_30px_-5px_rgba(34,211,238,0.4)] transition-all hover:scale-[1.02]"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Training Session
              </Link>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

import { useState, useEffect } from "react";
import { CATEGORY_META, getExercisesByCategory, type ExerciseCategory, type ExerciseConfig } from "../features/exercises/poseEngine";
import { motion, AnimatePresence } from "framer-motion";
import { RealisticExerciseCard } from "../features/exercises/components/RealisticExerciseCard";
import { ExerciseDetailModal } from "../features/exercises/components/ExerciseDetailModal";
import { db } from "../features/history/storage";
import { Dumbbell, Flower2, Accessibility, ArrowLeft, Flame, Trophy, Clock, Zap } from "lucide-react";

const CATEGORY_ICONS: Record<ExerciseCategory, typeof Dumbbell> = {
  strength: Dumbbell,
  yoga: Flower2,
  stretching: Accessibility,
};

const CATEGORY_IMAGES: Record<ExerciseCategory, string> = {
  strength: "https://lh3.googleusercontent.com/aida-public/AB6AXuBCAv4MrlZOyr85rLMLaojkGqBr1YTYsfqMWJE33Kukl84t9EvoYXXXIZWb9fZWdzf7PZaDEDBBr-zMv61Be1NFPcRtkYzn4ITE0gpa5t_aw-ylVp8d2f8Mt2fEG7gDOGRp96gxFeIVk0LGLIatDSlyJvhaZzeiXkWR5wZTJMcVMTgdz8MD1IzfPwCNJtZpZoIPD6PTeNib7pygfrWsp_03qcjxaPy9-KQcRqzRmXM7SoXjaULdzz3fWPi321f4V2OZq1ZkkefIJPg",
  yoga: "https://lh3.googleusercontent.com/aida-public/AB6AXuDEUg9gNRyvdrSK20oaw2a5iMg5-iLh2RTIp3p2hg0t7wKdO1RwBloLwdHehHvokVvFDx8Sns1FlG3TmDVRgxf4Clf0ZnPgKM5kra_uOmE5FR4ULe5ZjyS2TdjXY8fgLOJMuLVuwu0rHPuBLEcjU0eTIp64G8pycIOBSc4RjfJ_bsAfKmGUInrqLhrhehPzOaRfn3RfqlkJ2cdOp2sO0tT0n6EkMbMzje2dbsfYiZiRU30Wl54p0dRRQneTnYKTUEfKMXtEWdyiar4",
  stretching: "https://lh3.googleusercontent.com/aida-public/AB6AXuCdp-9ZESRbe7OnXpJz3V0ZgQ2qZBXEC7C9VjGuTJ6jGj1G_hlD7ralMCGll5kfn1EAuqa4utIauoxwHY61ZxGmRHtbQiscg82AN_30TIlGF1Ftrobb28TGpBDEOJXxnn6ldhUbzt32eE8Wqgbl7IhBFTWTDuM7uDXP6yWlPHdyp_2gNob3va_kEoEc1EdQl1rU0rGjcwo7vZwuQihRe1LHBTVF0o1pBWfRZvzsv9k46tA_dwRe2euAHeD2c-Iu9TkKxXK9wT9H-3M",
};

const CATEGORY_COLORS: Record<ExerciseCategory, string> = {
  strength: "from-amber-500/20 to-orange-500/20",
  yoga: "from-violet-500/20 to-purple-500/20",
  stretching: "from-emerald-500/20 to-teal-500/20",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function HeroStats() {
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    async function loadStats() {
      try {
        const workouts = await db.workouts.toArray();
        setTotalWorkouts(workouts.length);
        setTotalMinutes(Math.round(workouts.reduce((sum, w) => sum + w.durationSec, 0) / 60));
        
        // Calculate streak
        if (workouts.length === 0) { setStreak(0); return; }
        const sorted = workouts.sort((a, b) => b.timestamp - a.timestamp);
        
        const uniqueDates = Array.from(new Set(sorted.map(w => new Date(w.timestamp).toDateString())));
        
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        
        let streakCount = 0;
        let currentDateToCheck = new Date();
        
        if (uniqueDates[0] === today.toDateString()) {
           currentDateToCheck = today;
        } else if (uniqueDates[0] === yesterday.toDateString()) {
           currentDateToCheck = yesterday;
        } else {
           setStreak(0);
           return;
        }
        
        for (const dateStr of uniqueDates) {
           if (dateStr === currentDateToCheck.toDateString()) {
             streakCount++;
             currentDateToCheck.setDate(currentDateToCheck.getDate() - 1);
           } else {
             break;
           }
        }
        
        setStreak(streakCount);
      } catch { /* ignore */ }
    }
    loadStats();
  }, []);

  const stats = [
    { icon: Trophy, label: "Workouts", value: totalWorkouts, color: "text-amber-400" },
    { icon: Clock, label: "Minutes", value: totalMinutes, color: "text-cyan-400" },
    { icon: Flame, label: "Day Streak", value: streak, color: "text-orange-400" },
    { icon: Zap, label: "Exercises", value: "17+", color: "text-violet-400" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-12"
    >
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
          {getGreeting()}, <span className="text-gradient">Athlete</span>
        </h1>
        <p className="text-slate-400 text-lg">Pick a category and start your session.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            className="glass-card p-4 flex items-center gap-3"
          >
            <div className={`w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center ${stat.color}`}>
              <stat.icon size={18} />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-white tabular-nums tracking-tight leading-none">
                {stat.value}
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                {stat.label}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseConfig | null>(null);
  
  const exercisesByCategory = getExercisesByCategory();
  const categories: ExerciseCategory[] = Object.keys(CATEGORY_META) as ExerciseCategory[];

  return (
    <div className="min-h-[100vh] animated-bg text-slate-200 overflow-x-hidden relative pt-[100px] pb-16 px-6 md:px-12 grain-overlay">

      <div className="relative z-10 w-full max-w-[1440px] mx-auto flex flex-col">
        
        {!selectedCategory && <HeroStats />}

        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            {selectedCategory ? (
              <motion.h2 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }}
                className="text-2xl font-bold text-white"
              >
                {CATEGORY_META[selectedCategory].label} Exercises
              </motion.h2>
            ) : (
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">
                Choose Your Training
              </h2>
            )}
          </div>
          
          <AnimatePresence>
            {selectedCategory && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={() => setSelectedCategory(null)}
                className="flex items-center gap-2 px-4 py-2 glass-card hover:bg-white/[0.06] transition-colors text-sm font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Categories or Exercise Grid */}
        <AnimatePresence mode="wait">
        {!selectedCategory ? (
          <motion.div 
            key="categories"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
          >
            {categories.map((cat, i) => {
              const Icon = CATEGORY_ICONS[cat];
              const exercises = exercisesByCategory[cat];
              return (
                <motion.button
                  key={cat}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -6 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCategory(cat)}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.06] flex flex-col min-h-[340px] text-left transition-all duration-500 hover:border-cyan-400/30 hover:shadow-[0_0_60px_-15px_rgba(34,211,238,0.15)] cursor-pointer"
                >
                  {/* Background Image */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-50 transition-all duration-700 group-hover:scale-110 group-hover:opacity-60"
                    style={{ backgroundImage: `url(${CATEGORY_IMAGES[cat]})` }}
                  />
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent" />
                  
                  {/* Colored Glow */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${CATEGORY_COLORS[cat]} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                  {/* Content */}
                  <div className="absolute inset-0 z-10 flex flex-col justify-between p-7">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl glass-card flex items-center justify-center group-hover:border-cyan-400/20 transition-colors">
                      <Icon className="w-6 h-6 text-cyan-400" />
                    </div>

                    {/* Info */}
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                        {CATEGORY_META[cat].label}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        <span>{exercises.length} exercises</span>
                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                        <span>{exercises.filter(e => e.difficulty === 'beginner').length} beginner</span>
                      </div>
                      
                      {/* Muscle preview */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {[...new Set(exercises.flatMap(e => e.muscles.slice(0, 2)))].slice(0, 4).map(muscle => (
                          <span key={muscle} className="muscle-pill">{muscle}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          <motion.div 
            key="exercises"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {exercisesByCategory[selectedCategory].map((ex, i) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="h-full"
              >
                <RealisticExerciseCard 
                  exerciseId={ex.id}
                  exerciseName={ex.name}
                  description={ex.type === 'static' ? 'Hold and stabilize the position.' : 'Dynamic rep-based kinematic analysis.'}
                  demoUrl={ex.demoUrl}
                  difficulty={ex.difficulty}
                  muscles={ex.muscles}
                  estimatedMinutes={ex.estimatedMinutes}
                  onClick={() => setSelectedExercise(ex)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      <ExerciseDetailModal 
        exercise={selectedExercise} 
        onClose={() => setSelectedExercise(null)} 
      />
    </div>
  );
}

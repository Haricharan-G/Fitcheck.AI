import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, startOfWeek, isAfter } from "date-fns";
import { Activity, Clock, Target, AlertCircle, Flame, TrendingUp, Download, Trash2 } from "lucide-react";
import { db, type WorkoutSession, exportHistoryAsJSON } from "./storage";
import { motion, AnimatePresence } from "framer-motion";

function WeeklyStats({ sessions }: { sessions: WorkoutSession[] }) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeek = sessions.filter(s => isAfter(new Date(s.timestamp), weekStart));
  const totalMins = Math.round(thisWeek.reduce((sum, w) => sum + w.durationSec, 0) / 60);
  const totalReps = thisWeek.reduce((sum, w) => sum + w.repsCompleted, 0);

  // Find most frequent exercise
  const freq: Record<string, number> = {};
  thisWeek.forEach(s => { freq[s.exerciseName] = (freq[s.exerciseName] || 0) + 1; });
  const topExercise = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];

  const stats = [
    { icon: Flame, label: "This Week", value: thisWeek.length, unit: "sessions", color: "text-orange-400", bg: "from-orange-500/10 to-red-500/10" },
    { icon: Clock, label: "Time", value: totalMins, unit: "minutes", color: "text-cyan-400", bg: "from-cyan-500/10 to-blue-500/10" },
    { icon: TrendingUp, label: "Total Reps", value: totalReps, unit: "reps", color: "text-violet-400", bg: "from-violet-500/10 to-purple-500/10" },
    { icon: Target, label: "Top Exercise", value: topExercise ? topExercise[0] : "—", unit: topExercise ? `${topExercise[1]}x` : "", color: "text-emerald-400", bg: "from-emerald-500/10 to-teal-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={`glass-card p-5 relative overflow-hidden`}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${stat.bg} opacity-50`} />
          <div className="relative z-10">
            <div className={`w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.06] flex items-center justify-center ${stat.color} mb-3`}>
              <stat.icon size={16} />
            </div>
            <p className="text-2xl font-extrabold text-white tabular-nums tracking-tight leading-none mb-0.5">
              {stat.value}
            </p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {stat.unit || stat.label}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function History() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      try {
        const data = await db.workouts.orderBy("timestamp").reverse().toArray();
        setSessions(data);
        if (data.length > 0) {
          setSelectedId(data[0].id!);
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const clearHistory = async () => {
    if (confirm("Are you sure you want to delete all workout history?")) {
      await db.workouts.clear();
      setSessions([]);
      setSelectedId(null);
    }
  };

  const handleExport = async () => {
    const json = await exportHistoryAsJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `formcheck-history-${format(new Date(), "yyyy-MM-dd")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSessions = filter === "all" 
    ? sessions 
    : sessions.filter(s => s.category === filter);

  const selectedSession = sessions.find(s => s.id === selectedId);

  const categories = ["all", ...new Set(sessions.map(s => s.category))];

  return (
    <div className="min-h-screen animated-bg text-slate-200 overflow-x-hidden relative pt-28 pb-20 px-6 grain-overlay">
      <div className="relative z-10 max-w-[1200px] mx-auto">
        
        <motion.header 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10"
        >
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
              Your <span className="text-gradient">History</span>
            </h1>
            <p className="text-slate-400 text-lg">Track your progress and analyze performance.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleExport} className="glass-card px-5 py-3 flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all">
              <Download size={16} />
              Export
            </button>
            <button onClick={clearHistory} className="glass-card px-5 py-3 flex items-center gap-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 border-red-500/20 transition-all">
              <Trash2 size={16} />
              Clear
            </button>
            <Link to="/" className="bg-gradient-to-r from-cyan-400 to-blue-500 text-black px-6 py-3 rounded-2xl font-bold text-sm hover:shadow-[0_0_30px_-5px_rgba(34,211,238,0.4)] transition-shadow">
              New Session
            </Link>
          </div>
        </motion.header>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-white/10 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 glass-card">
            <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-xl font-bold text-white mb-2">No data yet</p>
            <p className="text-slate-400 mb-6">Complete a workout session to see your history.</p>
            <Link to="/" className="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold">Start Tracking</Link>
          </div>
        ) : (
          <>
            <WeeklyStats sessions={sessions} />

            {/* Category Filter Tabs */}
            <div className="flex gap-2 mb-8 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 border ${
                    filter === cat 
                      ? "bg-white/[0.08] border-cyan-400/30 text-white" 
                      : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8 items-start">
              
              {/* Timeline Column */}
              <div className="space-y-3">
                {filteredSessions.map((session) => (
                  <motion.div 
                    key={session.id}
                    layout
                    onClick={() => setSelectedId(session.id!)}
                    className={`cursor-pointer group transition-all duration-300 glass-card p-5 ${
                      selectedId === session.id 
                        ? 'border-cyan-400/20 shadow-[0_0_30px_-10px_rgba(34,211,238,0.15)]' 
                        : 'hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-colors ${
                        selectedId === session.id ? 'bg-cyan-400/10' : 'bg-white/[0.03]'
                      }`}>
                        {session.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-sm truncate">{session.exerciseName}</h3>
                        <p className="text-xs text-slate-500">
                          {format(session.timestamp, "MMM d, h:mm a")} · {Math.floor(session.durationSec / 60)}m {session.durationSec % 60}s
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold text-white tabular-nums">{session.repsCompleted}</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">reps</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Details Column */}
              <AnimatePresence mode="wait">
                {selectedSession && (
                  <motion.div
                    key={selectedSession.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="sticky top-28 glass-card p-8"
                  >
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/10 to-violet-500/10 border border-white/[0.06] flex items-center justify-center text-4xl">
                        {selectedSession.emoji}
                      </div>
                      <div>
                        <h2 className="text-3xl font-extrabold text-white">{selectedSession.exerciseName}</h2>
                        <p className="text-slate-400 font-medium">
                          {format(selectedSession.timestamp, "EEEE, MMMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-white/[0.03] border border-white/[0.06] p-6 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2 text-slate-500">
                          <Target size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Volume</span>
                        </div>
                        <p className="text-4xl font-extrabold text-white tabular-nums tracking-tighter">
                          {selectedSession.repsCompleted}
                        </p>
                      </div>
                      <div className="bg-white/[0.03] border border-white/[0.06] p-6 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2 text-slate-500">
                          <Clock size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Duration</span>
                        </div>
                        <p className="text-4xl font-extrabold text-white tabular-nums tracking-tighter">
                          {Math.floor(selectedSession.durationSec / 60)}:{String(selectedSession.durationSec % 60).padStart(2, '0')}
                        </p>
                      </div>
                    </div>

                    {/* Form Quality */}
                    <div>
                      <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">Form Analysis</h3>
                      {selectedSession.averageQuality !== null ? (
                        <div className="bg-white/[0.03] border border-emerald-500/15 p-6 rounded-2xl">
                           <div className="flex justify-between items-end mb-4">
                              <span className="text-emerald-400 font-bold text-sm">Depth Quality</span>
                              <span className="text-2xl font-bold text-white tabular-nums">{(selectedSession.averageQuality * 100).toFixed(0)}%</span>
                           </div>
                           <div className="w-full bg-white/[0.05] h-2 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${selectedSession.averageQuality * 100}%` }}
                               transition={{ duration: 1, ease: "easeOut" }}
                               className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full" 
                             />
                           </div>
                        </div>
                      ) : (
                        <div className="bg-white/[0.03] border border-white/[0.06] p-6 rounded-2xl flex items-start gap-4">
                           <AlertCircle className="text-slate-500 mt-1 shrink-0" />
                           <div>
                             <p className="font-bold text-white mb-1">Static Hold</p>
                             <p className="text-sm text-slate-400">Depth metrics are not tracked for isometric exercises.</p>
                           </div>
                        </div>
                      )}
                    </div>

                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </>
        )}
      </div>
    </div>
  );
}

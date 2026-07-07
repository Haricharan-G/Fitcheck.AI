import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, AlertCircle, Clock, ArrowLeft } from "lucide-react";
import { DrawingUtils, PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { motion, AnimatePresence } from "framer-motion";

import { usePoseTracker, type PoseFrame } from "./usePoseTracker";
import { useMovementEngine } from "./useMovementEngine";
import { useTelemetryStore } from "./store";
import { EXERCISE_SCHEMA, CATEGORY_META, calculateAngle } from "../exercises/poseEngine";
import { saveWorkout } from "../history/storage";
import { Sparkline } from "./components/Sparkline";
import { Odometer } from "../../components/ui/Odometer";
import { HoldRing } from "../../components/ui/HoldRing";
import { ReferenceVideo } from "../exercises/components/ReferenceVideo";
import { LottieCheckmark } from "../../components/ui/LottieCheckmark";

const VIDEO_W = 640;
const VIDEO_H = 480;

function IconVolume({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function useElapsedTimer(isCounting: boolean) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isCounting) return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCounting]);

  const reset = useCallback(() => {
    setElapsed(0);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return {
    formatted: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    totalSeconds: elapsed,
    reset,
  };
}

function AngleReadout({ perfectAngle }: { perfectAngle?: number }) {
  const currentAngle = useTelemetryStore(state => state.currentAngle);
  const isPerfect = currentAngle !== null && perfectAngle !== undefined && Math.abs(currentAngle - perfectAngle) <= 10;
  
  return (
    <div className="text-right">
      <p className={`text-[10px] uppercase tracking-widest font-bold ${isPerfect ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`}>
        {isPerfect ? "Perfect Depth!" : "Live Angle"}
      </p>
      <p className={`text-3xl font-bold tabular-nums leading-tight font-mono transition-colors ${isPerfect ? 'text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)] scale-110 transform origin-right duration-200' : 'text-white'}`}>
        {currentAngle !== null ? currentAngle.toFixed(1) : "—"}°
      </p>
    </div>
  );
}

export function Tracker() {
  const [searchParams] = useSearchParams();
  const exerciseId = searchParams.get("exercise") || "squat";
  const exercise = useMemo(() => EXERCISE_SCHEMA[exerciseId] || EXERCISE_SCHEMA["squat"], [exerciseId]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  
  const [showSummary, setShowSummary] = useState(false);
  const [tutorialPhase, setTutorialPhase] = useState<"pre-set" | "in-set">("in-set");
  const [calibrationTimeLeft, setCalibrationTimeLeft] = useState<number>(5);
  const [lottieTrigger, setLottieTrigger] = useState(0);
  const [a11yMessage, setA11yMessage] = useState("");
  const lastA11yRep = useRef(-1);

  const engine = useMovementEngine(exercise);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctxRef.current = ctx;
      if (ctx) {
        drawingUtilsRef.current = new DrawingUtils(ctx);
      }
    }
  }, [showSummary]);

  const handleEndSession = async () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(100);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setShowSummary(true);
    await saveWorkout({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      category: exercise.category,
      emoji: exercise.emoji,
      durationSec: sessionTime.totalSeconds,
      repsCompleted: engine.reps,
      averageQuality: exercise.type === 'static' ? null : (engine.averageRepQuality ?? 0.85)
    });
  };

  useEffect(() => {
    if (engine.reps > lastA11yRep.current) {
      setA11yMessage(`${engine.reps} completed`);
      if (lastA11yRep.current >= 0) {
        setLottieTrigger(prev => prev + 1);
        
        const container = document.getElementById("canvas-container");
        if (container) {
          container.classList.add("ring-4", "ring-brand-400/50", "scale-[1.01]");
          setTimeout(() => {
            container.classList.remove("ring-4", "ring-brand-400/50", "scale-[1.01]");
          }, 200);
        }
      }
      lastA11yRep.current = engine.reps;
    }
  }, [engine.reps]);

  const primaryIndices = useMemo(() => new Set<number>(exercise.primaryAngle.points), [exercise]);
  const altIndices = useMemo(() => new Set<number>(exercise.primaryAngle.altPoints || []), [exercise]);


  const drawSkeleton = useCallback(
    (results: PoseLandmarkerResult | null) => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      const drawingUtils = drawingUtilsRef.current;
      if (!ctx || !canvas || !drawingUtils) return;

      // Premium Clinical Biomechanics Style (White Background for Privacy)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Clinical engineering grid (subtle gray lines)
      ctx.strokeStyle = "#F1F5F9"; // slate-100
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();

      if (results?.landmarks && results.landmarks.length > 0) {
        const lm = results.landmarks[0];
        const currentAngle = useTelemetryStore.getState().currentAngle;
        
        // Perfect form: check if angle is near the exercise's ideal depth
        let isPerfectForm = false;
        if (currentAngle !== null) {
          if (exercise.perfectAngle !== undefined) {
            isPerfectForm = Math.abs(currentAngle - exercise.perfectAngle) <= 10;
          } else if (exercise.type === "dynamic") {
            // Fallback: use the "down" stage threshold as the perfect target
            isPerfectForm = currentAngle <= exercise.stages.down.enterWhen.lte + 5;
          }
        }
        
        // Isolate active joints strictly to the specific limb
        const flatActiveJoints = [...Array.from(primaryIndices), ...Array.from(altIndices)];
        // Separate active and inactive connections
        const activeConnections = PoseLandmarker.POSE_CONNECTIONS.filter((conn) => 
          (primaryIndices.has(conn.start) && primaryIndices.has(conn.end)) ||
          (altIndices.has(conn.start) && altIndices.has(conn.end))
        );

        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // --- DRAW ACTIVE SKELETON ---
        // Draw outer thick shell for the bones
        ctx.lineWidth = 14;
        ctx.strokeStyle = isPerfectForm ? "rgba(251, 191, 36, 0.15)" : "#0F172A";
        ctx.beginPath();
        activeConnections.forEach((conn) => {
          const pt1 = lm[conn.start];
          const pt2 = lm[conn.end];
          if (pt1 && pt2 && (pt1.visibility ?? 1) > 0.3 && (pt2.visibility ?? 1) > 0.3) {
            ctx.moveTo(pt1.x * canvas.width, pt1.y * canvas.height);
            ctx.lineTo(pt2.x * canvas.width, pt2.y * canvas.height);
          }
        });
        ctx.stroke();

        // Draw inner crisp white line to give a "biomechanical segment" look
        ctx.lineWidth = 4;
        ctx.strokeStyle = isPerfectForm ? "#FBBF24" : "#FFFFFF";
        ctx.beginPath();
        activeConnections.forEach((conn) => {
          const pt1 = lm[conn.start];
          const pt2 = lm[conn.end];
          if (pt1 && pt2 && (pt1.visibility ?? 1) > 0.3 && (pt2.visibility ?? 1) > 0.3) {
            ctx.moveTo(pt1.x * canvas.width, pt1.y * canvas.height);
            ctx.lineTo(pt2.x * canvas.width, pt2.y * canvas.height);
          }
        });
        ctx.stroke();
        
        // Draw only the active exercise joints (no other body parts)
        for (const index of flatActiveJoints) {
          const pt = lm[index];
          if (!pt || (pt.visibility ?? 1) <= 0.3) continue;
          
          const x = pt.x * canvas.width;
          const y = pt.y * canvas.height;

          // Outer glow
          ctx.beginPath();
          ctx.arc(x, y, 12, 0, 2 * Math.PI);
          ctx.fillStyle = isPerfectForm ? "rgba(251, 191, 36, 0.3)" : "rgba(45, 212, 191, 0.2)";
          ctx.fill();
          
          // Dark ring
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = "#0F172A";
          ctx.fill();

          // Core dot
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = isPerfectForm ? "#FBBF24" : "#FFFFFF"; // White core
          ctx.fill();
        }

        for (const idx of flatActiveJoints) {
          const pt = lm[idx];
          if (pt && (pt.visibility ?? 1) > 0.4) {
            const x = pt.x * canvas.width;
            const y = pt.y * canvas.height;

            // Real-time Angle HUD at the vertex
            const isPrimaryVertex = idx === exercise.primaryAngle.points[1];
            const isAltVertex = exercise.primaryAngle.altPoints && idx === exercise.primaryAngle.altPoints[1];
            
            if (currentAngle !== null && (isPrimaryVertex || isAltVertex)) {
              const pts = isPrimaryVertex ? exercise.primaryAngle.points : exercise.primaryAngle.altPoints!;
              const p1 = lm[pts[0]];
              const p2 = lm[pts[1]];
              const p3 = lm[pts[2]];
              
              if (p1 && p2 && p3) {
                const localAngle = calculateAngle(p1, p2, p3);
                
                // Draw Text Box
                const text = `${Math.round(localAngle)}°`;
                ctx.font = "bold 11px Inter, sans-serif";
                const textWidth = ctx.measureText(text).width;
                
                ctx.fillStyle = "rgba(15, 23, 42, 0.85)"; // Dark transparent background
                
                const rw = textWidth + 16, rh = 24, r = 6;
                const rx = x + 16;
                const ry = y - 24;
                
                ctx.beginPath();
                ctx.moveTo(rx + r, ry);
                ctx.lineTo(rx + rw - r, ry);
                ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
                ctx.lineTo(rx + rw, ry + rh - r);
                ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
                ctx.lineTo(rx + r, ry + rh);
                ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
                ctx.lineTo(rx, ry + r);
                ctx.quadraticCurveTo(rx, ry, rx + r, ry);
                ctx.closePath();
                ctx.fill();
                
                ctx.lineWidth = 1;
                ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"; // Subtle white border
                ctx.stroke();
                
                const isActive = Math.abs(currentAngle - localAngle) < 10;
                
                ctx.fillStyle = isPerfectForm ? "#F59E0B" : (isActive ? "#2dd4bf" : "#64748B"); 
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                
                // Un-mirror the text so it's readable on the flipped canvas!
                ctx.save();
                ctx.translate(rx + rw/2, ry + rh/2);
                ctx.scale(-1, 1);
                ctx.fillText(text, 0, 0);
                ctx.restore();

                // Draw angle arc
                const a1 = Math.atan2(p1.y - p2.y, p1.x - p2.x);
                const a2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
                
                let diff = a2 - a1;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                const counterclockwise = diff < 0;

                // Draw Target/Safe Angle Wedge
                let targetRad: number | null = null;
                if (exercise.perfectAngle !== undefined) {
                  targetRad = (exercise.perfectAngle * Math.PI) / 180;
                } else if (exercise.type === "dynamic") {
                  targetRad = (exercise.stages.down.enterWhen.lte * Math.PI) / 180;
                }

                if (targetRad !== null) {
                  const targetCenter = a1 + (counterclockwise ? -targetRad : targetRad);
                  const delta = 10 * Math.PI / 180;
                  
                  // When drawing counterclockwise, startAngle must be numerically greater than endAngle to draw the short path
                  const targetStart = counterclockwise ? targetCenter + delta : targetCenter - delta;
                  const targetEnd = counterclockwise ? targetCenter - delta : targetCenter + delta;
                  
                  ctx.beginPath();
                  ctx.moveTo(x, y);
                  ctx.arc(x, y, 60, targetStart, targetEnd, counterclockwise);
                  ctx.fillStyle = "rgba(45, 212, 191, 0.25)"; // Teal target wedge
                  ctx.fill();
                }

                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.arc(x, y, 60, a1, a2, counterclockwise);
                ctx.fillStyle = isPerfectForm ? "rgba(251, 191, 36, 0.4)" : (isActive ? "rgba(15, 23, 42, 0.6)" : "rgba(15, 23, 42, 0.2)");
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(x, y, 60, a1, a2, counterclockwise);
                ctx.strokeStyle = isPerfectForm ? "#FBBF24" : (isActive ? "#2dd4bf" : "#475569");
                ctx.lineWidth = isActive ? 3 : 2;
                ctx.stroke();
                
                // Draw connecting lines to the arc
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(a1) * 60 * 1.3, y + Math.sin(a1) * 60 * 1.3);
                ctx.setLineDash([4, 4]);
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = isActive ? "#94A3B8" : "#475569";
                ctx.stroke();
                ctx.setLineDash([]);
              }
            }
          }
        }
      }
      ctx.restore();
    },
    [exercise, primaryIndices, altIndices]
  );

  const onFrame = useCallback(
    (frame: PoseFrame) => {
      if (showSummary) return;
      if (frame.landmarks && calibrationTimeLeft === 0 && tutorialPhase === "in-set") {
        engine.processFrame(frame.landmarks);
      }
      drawSkeleton(frame.results);
    },
    [engine, drawSkeleton, showSummary, calibrationTimeLeft, tutorialPhase]
  );

  const { videoRef, setupState, error } = usePoseTracker({
    onFrame,
    width: VIDEO_W,
    height: VIDEO_H,
    modelComplexity: CATEGORY_META[exercise.category].modelComplexity,
  });

  const isCounting = setupState === "ready" && tutorialPhase === "in-set" && calibrationTimeLeft <= 0 && !showSummary;
  const sessionTime = useElapsedTimer(isCounting);

  useEffect(() => {
    if (setupState !== "ready" || tutorialPhase !== "in-set" || calibrationTimeLeft <= 0 || showSummary) return;
    const timer = setInterval(() => {
      setCalibrationTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [setupState, calibrationTimeLeft, showSummary, tutorialPhase]);

  const isStatic = exercise.type === "static";
  const stageActive = exercise.id === "shoulderPress" 
    ? engine.stage === "up" 
    : (engine.stage === "down" || engine.stage === "in");

  return (
    <div className="min-h-screen bg-[#0a0a0a] animate-fade-in relative font-sans text-slate-200 overflow-hidden">
      
      <div aria-live="assertive" className="sr-only">{a11yMessage}</div>

      {showSummary && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 animate-fade-in p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-[#0d0d0d] border border-white/[0.08] rounded-3xl p-8 max-w-md w-full text-center shadow-[0_0_80px_-20px_rgba(34,211,238,0.2)]"
          >
            {/* Success Icon */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400/20 to-violet-500/20 border border-cyan-400/20 flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">{exercise.emoji}</span>
            </div>

            <h2 className="text-3xl font-extrabold text-white mb-1">Session Complete!</h2>
            <p className="text-slate-400 mb-8">{exercise.name}</p>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-2xl font-extrabold text-cyan-400 tabular-nums">{engine.reps}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">{isStatic ? "Seconds" : "Reps"}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-2xl font-extrabold text-white tabular-nums">{sessionTime.formatted}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Duration</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-2xl font-extrabold text-emerald-400">
                  {isStatic ? "N/A" : `${Math.round((engine.averageRepQuality ?? 0.85) * 100)}%`}
                </p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Form Score</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Link to="/history" className="bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold py-4 rounded-xl shadow-[0_0_30px_-5px_rgba(34,211,238,0.4)] hover:shadow-[0_0_40px_-5px_rgba(34,211,238,0.5)] transition-shadow text-center">
                View History
              </Link>
              <Link to="/" className="bg-white/[0.04] text-white font-bold py-4 rounded-xl border border-white/[0.06] hover:bg-white/[0.08] transition-colors text-center">
                Back to Dashboard
              </Link>
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══ Full Screen Split Layout ═══ */}
      <div className="absolute inset-0 flex flex-row">
        
        {/* Left Half: Reference Video (Only visible in-set) */}
        {tutorialPhase === "in-set" && (
          <div className="relative w-1/2 h-full bg-black border-r border-slate-200">
            <ReferenceVideo 
              phase={tutorialPhase} 
              exercise={exercise}
              formErrorTime={engine.formBreakdowns.length > 0 ? 0 : null}
            />
            {/* Overlay gradient for UI text */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
            
            <div className="absolute top-8 left-8 z-50">
              <Link to="/" className="pointer-events-auto flex items-center justify-center w-12 h-12 mb-6 bg-black/40 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-md shadow-lg group">
                <ArrowLeft className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" />
              </Link>
              <h1 className="text-3xl font-extrabold text-white uppercase tracking-widest leading-tight">{exercise.name}</h1>
              <p className="text-cyan-400 font-bold uppercase tracking-widest mt-2 text-xs">{CATEGORY_META[exercise.category].label}</p>
            </div>
            
            <div className="absolute bottom-8 left-8 z-50 flex items-center gap-4">
               <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-8 py-3 rounded-full flex items-center gap-3">
                 <Clock size={16} className="text-cyan-400" />
                 <span className="font-mono text-xl font-extrabold text-white tabular-nums tracking-widest">{sessionTime.formatted}</span>
               </div>
               <button
                 onClick={() => engine.setMuted(!engine.muted)}
                 className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border transition-colors ${!engine.muted ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-black/40 border-white/10 text-slate-400'}`}
               >
                 <IconVolume muted={engine.muted} />
               </button>
               <button 
                 onClick={handleEndSession} 
                 className="pointer-events-auto bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-bold px-6 py-0 h-12 rounded-full backdrop-blur-md uppercase tracking-widest text-xs transition-colors"
               >
                 End Session
               </button>
            </div>
          </div>
        )}

        {/* Right Half (Or Full if pre-set): Tracking Canvas */}
        <div id="canvas-container" className={`relative h-full transition-all duration-500 bg-white ${tutorialPhase === "in-set" ? "w-1/2" : "w-full"}`}>
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover -scale-x-100 transition-opacity duration-1000 ${tutorialPhase === "pre-set" ? "opacity-30 blur-sm" : "opacity-0"}`}
            autoPlay playsInline muted
          />
          
          <canvas
            ref={canvasRef}
            width={VIDEO_W}
            height={VIDEO_H}
            className="absolute inset-0 w-full h-full -scale-x-100 z-30 pointer-events-none"
          />

          {/* Phase A: Pre-Set Reference Video */}
          {setupState === "ready" && !error && tutorialPhase === "pre-set" && (
             <ReferenceVideo 
               phase={tutorialPhase} 
               exercise={exercise}
               onReady={() => setTutorialPhase("in-set")}
             />
          )}

        {/* Calibration Timer */}
        {setupState === "ready" && tutorialPhase === "in-set" && calibrationTimeLeft > 0 && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-30">
            <p className="text-xl font-bold text-brand-400 uppercase tracking-widest mb-4">Step Back Into Frame</p>
            <div className="text-[15rem] leading-none font-extrabold text-white tabular-nums drop-shadow-2xl">
              {calibrationTimeLeft}
            </div>
          </div>
        )}

        {/* Loading / Error States */}
        {setupState !== "ready" && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] z-40 grain-overlay">
            <div className="relative flex items-center justify-center w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
              <div className="absolute inset-0 border-4 border-cyan-400 rounded-full animate-[spin_1.5s_linear_infinite] border-t-transparent border-r-transparent" />
              <div className="absolute inset-0 border-4 border-violet-500 rounded-full animate-[spin_2s_linear_infinite_reverse] border-b-transparent border-l-transparent opacity-60" />
              <Activity className="w-8 h-8 text-cyan-400 animate-pulse" />
            </div>
            
            <div className="flex flex-col items-center space-y-2 h-16">
              <p className="text-sm font-bold text-white tracking-[0.2em] uppercase animate-fade-up">
                {setupState === "idle" && "Initializing Neural Net..."}
                {setupState === "model" && "Loading Vision Models..."}
                {setupState === "camera" && "Connecting Camera..."}
              </p>
              <div className="flex gap-1.5 mt-2">
                <span className={`w-1.5 h-1.5 rounded-full ${setupState === "idle" ? "bg-cyan-400" : "bg-white/20"} transition-colors`} />
                <span className={`w-1.5 h-1.5 rounded-full ${setupState === "model" ? "bg-cyan-400" : "bg-white/20"} transition-colors`} />
                <span className={`w-1.5 h-1.5 rounded-full ${setupState === "camera" ? "bg-cyan-400" : "bg-white/20"} transition-colors`} />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] z-40 px-8 text-center grain-overlay">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
              <AlertCircle className="text-red-400 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Setup Failed</h2>
            <p className="text-red-400 max-w-md">{error}</p>
          </div>
        )}
      </div>
      {/* End of Split Layout */}
      </div>

      {/* ═══ 10-Foot HUD Overlays (Only visible during in-set) ═══ */}
      <AnimatePresence>
        {setupState === "ready" && tutorialPhase === "in-set" && calibrationTimeLeft <= 0 && !error && (
          <>
            {/* Right Sidebar: Telemetry Zone */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }}
              className="absolute top-1/2 -translate-y-1/2 right-8 z-50 flex flex-col items-end gap-4 w-72 pointer-events-none"
            >
              {/* Form Feedback Panel */}
              <AnimatePresence>
                {engine.formBreakdowns.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, y: 20 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    className="w-full bg-red-950/80 border border-red-500/50 p-5 rounded-3xl backdrop-blur-xl shadow-[0_0_40px_-10px_rgba(239,68,68,0.4)] pointer-events-auto overflow-hidden"
                  >
                     <div className="flex items-center gap-2 mb-2">
                       <AlertCircle className="w-4 h-4 text-red-400 animate-pulse" />
                       <p className="text-[10px] text-red-400 uppercase tracking-[0.2em] font-bold">Form Correction</p>
                     </div>
                      <p className="text-sm font-bold text-white leading-snug">{engine.formBreakdowns[0].message}</p>
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Flow Sparkline */}
               <div className="w-full bg-black/40 backdrop-blur-md border border-white/10 p-5 rounded-3xl shadow-xl pointer-events-auto">
                 <div className="flex items-center justify-between mb-2">
                   <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">Flow</p>
                   <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${stageActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/10 text-slate-400'}`}>
                     {stageActive ? 'Active' : 'Rest'}
                   </span>
                 </div>
                 <div className="h-12 mt-2">
                    <Sparkline maxAngle={180} color={stageActive ? "#2dd4bf" : "#64748b"} />
                 </div>
               </div>

              {/* Primary Metric: Reps/Hold */}
              <div className="w-full bg-black/40 backdrop-blur-md border border-white/10 p-8 rounded-3xl shadow-xl pointer-events-auto flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold z-10 mb-2">
                  {isStatic ? "Hold Duration" : "Total Reps"}
                </p>
                <div className="relative z-10 flex items-center justify-center">
                  <div className="font-mono text-7xl font-extrabold text-white tabular-nums tracking-tighter drop-shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                    {isStatic ? engine.holdElapsedSec.toFixed(1) : <Odometer value={engine.reps} />}
                  </div>
                </div>
              </div>

              {/* Secondary Metric: Angle / Depth */}
              <div className="w-full bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl pointer-events-auto flex items-center justify-between">
                {isStatic ? (
                  <>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">Target Zone</p>
                    <div className="relative flex items-center justify-center w-16 h-16 scale-75 origin-right">
                      <div className="absolute inset-0 pointer-events-none">
                        <HoldRing size={80} strokeWidth={6} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <AngleReadout perfectAngle={exercise.perfectAngle} />
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Center Success Ripple */}
      {tutorialPhase === "in-set" && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
          <LottieCheckmark trigger={lottieTrigger} />
          {engine.stage === "in" && (
            <>
              <div className="absolute w-24 h-24 rounded-full border-2 border-primary/50 animate-ripple"></div>
              <div className="absolute w-12 h-12 flex items-center justify-center">
                <div className="w-[2px] h-full bg-primary/30"></div>
                <div className="absolute w-full h-[2px] bg-primary/30"></div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
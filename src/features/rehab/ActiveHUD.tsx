import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ProtocolConfig, TelemetryFrame } from "./types";
import { Goniometer } from "./components/Goniometer";
import { usePoseTracker } from "../tracker/usePoseTracker";
import { calculateAngle } from "../exercises/poseEngine";

interface ActiveHUDProps {
  config: ProtocolConfig;
  onFinish: (telemetryLog: TelemetryFrame[]) => void;
}

// Removed mock compensation messages

export function ActiveHUD({ config, onFinish }: ActiveHUDProps) {
  const [elapsed, setElapsed] = useState(0);
  const [reps, setReps] = useState(0);
  const [telemetry, setTelemetry] = useState<TelemetryFrame>(() => ({
    currentAngle: config.romMin,
    angularVelocity: 0,
    tempoPhase: "flexion",
    tempoProgress: 0,
    tempoAdherence: 0.92, // Kept for type compatibility but unused in UI
    compensationDetected: false,
    compensationMessage: null,
    timestamp: Date.now(),
  }));
  // Removed compensationAlert state
  const [isFinishing, setIsFinishing] = useState(false);
  const logRef = useRef<TelemetryFrame[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const repStateRef = useRef({ reachedMax: false });
  const [liveRomMin, setLiveRomMin] = useState(config.romMin);
  const [liveRomMax, setLiveRomMax] = useState(config.romMax);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Initialize Canvas
  useEffect(() => {
    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext("2d");
    }
  }, []);

  const onFrame = useCallback((frame: { landmarks: any; results: any }) => {
    // 1. Draw Skeleton
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas && frame.results) {
      // Premium Clinical Biomechanics Style (White Background for Privacy)
      ctx.fillStyle = "#FFFFFF"; // Pure white background
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

      const lm = frame.results.landmarks?.[0];
      if (lm) {
        // Identify active joints for the protocol to highlight them (both sides)
        let activeJointTriplets: number[][] = [];
        if (config.jointProtocol.includes("knee")) activeJointTriplets = [[24, 26, 28], [23, 25, 27]];
        else if (config.jointProtocol.includes("shoulder")) activeJointTriplets = [[24, 12, 14], [23, 11, 13]];
        else if (config.jointProtocol.includes("elbow")) activeJointTriplets = [[12, 14, 16], [11, 13, 15]];
        else activeJointTriplets = [[24, 26, 28], [23, 25, 27]];
        
        const flatActiveJoints = activeJointTriplets.flat();

        // Check if current angle is in the safe ROM zone for perfect form state
        const isPerfectForm = telemetry.currentAngle >= config.romMin && telemetry.currentAngle <= config.romMax;
        
        const POSE_LINES = [
          [11,12], [11,13], [13,15], [12,14], [14,16],
          [11,23], [12,24], [23,24],
          [23,25], [25,27], [24,26], [26,28],
          [27,29], [28,30], [29,31], [30,32]
        ];
        
        // Filter bones to strictly isolate individual limbs
        const filteredPoseLines = POSE_LINES.filter(([p1, p2]) => 
          activeJointTriplets.some(triplet => triplet.includes(p1) && triplet.includes(p2))
        );
        
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Draw outer thick shell for the bones
        ctx.lineWidth = 14;
        ctx.strokeStyle = isPerfectForm ? "rgba(251, 191, 36, 0.25)" : "#0F172A";
        ctx.beginPath();
        filteredPoseLines.forEach(([p1, p2]) => {
          const pt1 = lm[p1];
          const pt2 = lm[p2];
          if (pt1 && pt2 && pt1.visibility > 0.5 && pt2.visibility > 0.5) {
            ctx.moveTo(pt1.x * canvas.width, pt1.y * canvas.height);
            ctx.lineTo(pt2.x * canvas.width, pt2.y * canvas.height);
          }
        });
        ctx.stroke();

        // Draw inner crisp line
        ctx.lineWidth = 4;
        ctx.strokeStyle = isPerfectForm ? "#FBBF24" : "#FFFFFF";
        ctx.beginPath();
        filteredPoseLines.forEach(([p1, p2]) => {
          const pt1 = lm[p1];
          const pt2 = lm[p2];
          if (pt1 && pt2 && pt1.visibility > 0.5 && pt2.visibility > 0.5) {
            ctx.moveTo(pt1.x * canvas.width, pt1.y * canvas.height);
            ctx.lineTo(pt2.x * canvas.width, pt2.y * canvas.height);
          }
        });
        ctx.stroke();
        
        // Draw only active exercise joints (no other body parts)
        for (const index of flatActiveJoints) {
          const pt = lm[index];
          if (!pt || pt.visibility <= 0.5) continue;
          
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
          ctx.fillStyle = isPerfectForm ? "#FBBF24" : "#FFFFFF";
          ctx.fill();
        }

        // --- ON-CANVAS GONIOMETER & SAFE LIMITS ZONE (Bilateral) ---
        activeJointTriplets.forEach(triplet => {
          if (triplet.length === 3) {
            const p1 = lm[triplet[0]]; 
            const p2 = lm[triplet[1]]; // Center
            const p3 = lm[triplet[2]]; 
            
            if (p1 && p2 && p3) {
            const x1 = p1.x * canvas.width;
            const y1 = p1.y * canvas.height;
            const x2 = p2.x * canvas.width;
            const y2 = p2.y * canvas.height;
            const x3 = p3.x * canvas.width;
            const y3 = p3.y * canvas.height;
            
            const angle1 = Math.atan2(y1 - y2, x1 - x2);
            const angle3 = Math.atan2(y3 - y2, x3 - x2);
            const radius = 60;
            
            // Calculate 2D interior angle
            let diff = angle3 - angle1;
            while (diff <= -Math.PI) diff += 2 * Math.PI;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            
            const isClockwise = diff > 0;
            const absAngleRad = Math.abs(diff);
            
            const minRad = (liveRomMin * Math.PI) / 180;
            const maxRad = (liveRomMax * Math.PI) / 180;
            
            // Base reference line (dotted)
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 + Math.cos(angle1) * radius * 1.3, y2 + Math.sin(angle1) * radius * 1.3);
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = "#475569"; // slate-600, much darker for visibility on white
            ctx.stroke();
            ctx.setLineDash([]);
            
            const minAngle = angle1 + (isClockwise ? minRad : -minRad);
            const maxAngle = angle1 + (isClockwise ? maxRad : -maxRad);
            
            // Safe Range Selected Zone (Teal)
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.arc(x2, y2, radius, minAngle, maxAngle, !isClockwise);
            ctx.fillStyle = "rgba(45, 212, 191, 0.6)"; // Teal, high opacity for white bg
            ctx.fill();
            
            // Active Joint Tracking Wedge (Dark Slate to contrast)
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.arc(x2, y2, radius, angle1, angle1 + (isClockwise ? absAngleRad : -absAngleRad), !isClockwise);
            ctx.fillStyle = "rgba(15, 23, 42, 0.6)"; // Dark slate tracking wedge
            ctx.fill();
            
            // Current Angle Stroke Line
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 + Math.cos(angle3) * radius * 1.1, y2 + Math.sin(angle3) * radius * 1.1);
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#2dd4bf"; // Bright Teal
            ctx.stroke();
            
            // Floating Angle Badge (Sleek Dark Mode)
            const midAngle = angle1 + diff / 2;
            const textX = x2 + Math.cos(midAngle) * (radius + 24);
            const textY = y2 + Math.sin(midAngle) * (radius + 24);
            const displayAngle = Math.round((absAngleRad * 180) / Math.PI) || 0;
            
            // Custom safe rounded rectangle (since ctx.roundRect might throw in some environments)
            const rw = 40, rh = 24, r = 6;
            const rx = textX - rw / 2;
            const ry = textY - rh / 2;
            
            ctx.fillStyle = "rgba(15, 23, 42, 0.85)"; // Dark transparent background
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
            
            ctx.fillStyle = "#2dd4bf"; // Teal text
            ctx.font = "bold 11px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            ctx.save();
            ctx.translate(textX, textY);
            ctx.scale(-1, 1);
            ctx.fillText(`${displayAngle}°`, 0, 0);
            ctx.restore();
            }
          }
        });
      }
    }

    // 2. Extract angle if landmarks exist
    const lm2 = frame.landmarks;
    if (lm2) {
       // Define joint mappings based on protocol (both sides)
       let triplets: number[][] = [];
       if (config.jointProtocol.includes("knee")) triplets = [[24, 26, 28], [23, 25, 27]];
       else if (config.jointProtocol.includes("shoulder")) triplets = [[24, 12, 14], [23, 11, 13]];
       else if (config.jointProtocol.includes("elbow")) triplets = [[12, 14, 16], [11, 13, 15]];
       else triplets = [[24, 26, 28], [23, 25, 27]];

       let bestAngle = NaN;
       
       triplets.forEach(triplet => {
         const p1 = lm2[triplet[0]];
         const p2 = lm2[triplet[1]];
         const p3 = lm2[triplet[2]];
         if (p1 && p2 && p3) {
           const ang = calculateAngle(p1, p2, p3);
           if (!isNaN(ang)) {
             // Track the limb that is furthest from the safe minimum (i.e., deepest into the exercise)
             if (isNaN(bestAngle) || Math.abs(ang - liveRomMin) > Math.abs(bestAngle - liveRomMin)) {
               bestAngle = ang;
             }
           }
         }
       });

       if (!isNaN(bestAngle)) {
         let angle = bestAngle;

         // --- Robust Rep Counting State Machine ---
         // Placed outside setTelemetry because state updaters must be pure functions
         const range = liveRomMax - liveRomMin;
         const targetUpper = liveRomMax - (range * 0.15); // Top 15% of ROM
         const targetLower = liveRomMin + (range * 0.25); // Bottom 25% of ROM

         if (angle >= targetUpper) {
           // User reached the peak of the movement
           repStateRef.current.reachedMax = true;
         } else if (angle <= targetLower) {
           // User returned to the starting position
           if (repStateRef.current.reachedMax) {
             setReps(r => r + 1);
             repStateRef.current.reachedMax = false; // Reset for next rep
           }
         }

         setTelemetry(prev => {
           const now = Date.now();
           const dt = (now - prev.timestamp) / 1000;
           const angularVelocity = dt > 0 ? Math.abs((angle - prev.currentAngle) / dt) : 0;
           
           // Basic logic to determine phase with a small deadband (hysteresis) to ignore micro-jitter
           let phase = prev.tempoPhase;
           if (angle > prev.currentAngle + 1.5) phase = "extension";
           else if (angle < prev.currentAngle - 1.5) phase = "flexion";
           
           const frameData: TelemetryFrame = {
             ...prev,
             currentAngle: angle,
             angularVelocity: angularVelocity * 0.2 + prev.angularVelocity * 0.8, // smooth
             tempoPhase: phase,
             timestamp: now
           };
           logRef.current.push(frameData);
           return frameData;
         });
       }
    }
  }, [config, liveRomMin, liveRomMax]);

  const { videoRef } = usePoseTracker({
    onFrame,
    width: 640,
    height: 480,
    modelComplexity: 1
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFinish = () => {
    setIsFinishing(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimeout(() => onFinish(logRef.current), 800);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      className="fixed inset-0 z-30 flex flex-col bg-[#000000] overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Simulated camera noise texture & Ambient Glow */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none z-0 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* ═══ TOP BAR ═══ */}
      <div className="relative z-10 px-8 pt-8 pb-4 max-w-7xl mx-auto w-full">
        {/* Status row */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-teal-400">
                Live Session
              </span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <span className="text-xs font-semibold text-white/50 tracking-wider">
              {config.jointLabel} Protocol
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right flex flex-col justify-center">
              <span className="text-[9px] text-white/40 font-bold uppercase tracking-[0.2em]">
                Elapsed
              </span>
              <span className="text-xl font-black text-white tabular-nums drop-shadow-md">
                {formatTime(elapsed)}
              </span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-right flex flex-col justify-center">
              <span className="text-[9px] text-white/40 font-bold uppercase tracking-[0.2em]">
                Reps
              </span>
              <span className="text-xl font-black text-teal-400 tabular-nums drop-shadow-md">
                {reps}
              </span>
            </div>
            
            <div className="w-px h-8 bg-white/10 mx-2" />

            <motion.button
              onClick={handleFinish}
              className="px-6 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-black uppercase tracking-[0.2em] hover:bg-red-500/20 hover:border-red-500/40 transition-all cursor-pointer shadow-[0_0_20px_rgba(239,68,68,0.1)]"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              End Set
            </motion.button>
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT (BENTO GRID) ═══ */}
      <div className="relative z-10 flex-1 flex flex-col px-8 pb-8">
        <div className="m-auto w-full max-w-7xl min-h-[500px] grid grid-cols-12 gap-6">
          
          {/* Left panel — Live feed (Span 5) */}
          <div className="col-span-5 relative rounded-[2rem] overflow-hidden border border-white/5 bg-[#050505] shadow-2xl">
            <video 
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-0" 
              playsInline 
              muted
              autoPlay
            />
            <canvas 
              ref={canvasRef}
              width={640} 
              height={480}
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1] z-10"
            />
            
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
              <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                <span className="text-[9px] font-black tracking-[0.15em] text-white/90 uppercase">Active</span>
              </div>
            </div>
            
            {/* Soft inner shadow for depth */}
            <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] pointer-events-none" />
          </div>

          {/* Center panel — Goniometer (Span 4) */}
          <div className="col-span-4 relative rounded-[2rem] border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent shadow-2xl flex flex-col items-center justify-center p-8 overflow-hidden backdrop-blur-3xl">
            {/* Ambient center glow */}
            <div className="absolute inset-0 bg-teal-500/5 mix-blend-screen pointer-events-none" />

            {/* Goniometer */}
            <div className="flex-1 flex justify-center w-full">
              <Goniometer
                currentAngle={telemetry.currentAngle}
                romMin={liveRomMin}
                romMax={liveRomMax}
              />
            </div>
          </div>

          {/* Right panel — Metrics Grid (Span 3) */}
          <div className="col-span-3 flex flex-col">
            {/* ROM bounds card (Interactive) */}
            <div className="flex-1 rounded-[2rem] border border-white/5 bg-[#050505] p-6 flex flex-col justify-center">
              <div className="flex justify-between items-center mb-8">
                <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/40 block">
                  Range of Motion Limits
                </span>
                <span className="text-[9px] font-bold tracking-widest uppercase text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">Live Adjust</span>
              </div>
              <div className="flex flex-col gap-8">
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Min Safe</span>
                    <span className="text-[10px] font-black text-white tabular-nums">{liveRomMin}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="180"
                    value={liveRomMin}
                    onChange={(e) => setLiveRomMin(Number(e.target.value))}
                    className="w-full accent-teal-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Max Safe</span>
                    <span className="text-[10px] font-black text-white tabular-nums">{liveRomMax}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="180"
                    value={liveRomMax}
                    onChange={(e) => setLiveRomMax(Number(e.target.value))}
                    className="w-full accent-teal-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Finishing overlay */}
      <AnimatePresence>
        {isFinishing && (
          <motion.div
            className="absolute inset-0 z-40 flex items-center justify-center"
            style={{ backgroundColor: "rgba(2, 6, 23, 0.9)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="text-center"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
            >
              <span className="text-5xl mb-4 block">✓</span>
              <span className="text-2xl font-black text-emerald-400 tracking-tight">
                Set Complete
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

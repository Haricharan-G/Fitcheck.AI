import { useRef, useEffect } from "react";
import type { ExerciseConfig } from "../poseEngine";


type ExerciseType = ExerciseConfig;

interface Props {
  phase: "pre-set" | "in-set";
  exercise: ExerciseType;
  videoUrl?: string;
  onReady?: () => void;
  formErrorTime?: number | null; // Trigger scrub
}

export function ReferenceVideo({
  phase,
  exercise,
  onReady,
  formErrorTime
}: Props) {
  const videoUrl = exercise.videoUrl || "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
  const videoRef = useRef<HTMLVideoElement>(null);
  const isYouTubeEmbed = /youtube(?:-nocookie)?\.com\/embed\//.test(videoUrl);

  // Form error scrub logic
  useEffect(() => {
    if (formErrorTime != null && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = formErrorTime;
      // After scrubbing, maybe highlight or wait a second before resuming?
      const t = setTimeout(() => {
        if (videoRef.current) videoRef.current.play();
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [formErrorTime]);

  if (phase === "pre-set") {
    return (
      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-fade-in">
        
        <div className="relative w-full max-w-5xl rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl bg-black/80 flex flex-col md:flex-row">
          
          {/* Left Panel: Video */}
          <div className="relative w-full md:w-[60%] aspect-video bg-black">
            {isYouTubeEmbed ? (
              <iframe
                src={videoUrl}
                title={`${exercise.name} reference video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            ) : (
              <video
                ref={videoRef}
                src={videoUrl}
                autoPlay
                loop
                muted
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

            {/* Top Badges */}
            <div className="absolute top-6 left-6 flex gap-3">
               {exercise.perfectAngle && (
                 <div className="bg-black/40 border border-cyan-500/30 px-4 py-2 rounded-full flex gap-2 items-center backdrop-blur-md shadow-lg">
                   <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Target Angle</span>
                   <span className="text-sm font-extrabold text-white">{exercise.perfectAngle}°</span>
                 </div>
               )}
               {exercise.type === 'static' && exercise.holdDurationSec && (
                 <div className="bg-black/40 border border-violet-500/30 px-4 py-2 rounded-full flex gap-2 items-center backdrop-blur-md shadow-lg">
                   <span className="text-[10px] text-violet-300 font-bold uppercase tracking-widest">Hold Target</span>
                   <span className="text-sm font-extrabold text-white">{exercise.holdDurationSec}s</span>
                 </div>
               )}
            </div>

            {/* Bottom Title overlay (Optional) */}
            <div className="absolute bottom-6 left-6">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Demonstration</p>
              <h3 className="text-2xl font-extrabold text-white tracking-wide">{exercise.name}</h3>
            </div>
          </div>

          {/* Right Panel: Instructions & Controls */}
          <div className="w-full md:w-[40%] p-8 lg:p-10 flex flex-col justify-center bg-white/5 border-l border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <span className="text-9xl">{exercise.emoji}</span>
            </div>

            <div className="relative z-10">
              <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest mb-2">{exercise.category}</p>
              <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-2 leading-tight">{exercise.name}</h2>
              <p className="text-slate-400 text-sm font-medium mb-8 uppercase tracking-wider">{exercise.target}</p>

              <div className="space-y-5 mb-10">
                {exercise.instructions.map((inst: string, i: number) => (
                  <div key={i} className="flex gap-4 items-start">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xs font-bold border border-cyan-500/30 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-slate-300 text-sm leading-relaxed">{inst}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={onReady}
                className="w-full py-5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-lg uppercase tracking-widest rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_40px_-10px_rgba(34,211,238,0.5)]"
              >
                Begin Session
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // Phase B: In-Set Reference
  return (
    <div className="w-full h-full">
      {isYouTubeEmbed ? (
        <iframe
          src={videoUrl}
          title={`${exercise.name} reference video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      ) : (
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          loop
          muted
          className="w-full h-full object-cover pointer-events-none"
        />
      )}
    </div>
  );
}

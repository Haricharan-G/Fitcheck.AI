import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { Play, Clock, Signal } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, Environment, useAnimations } from "@react-three/drei";
import { motion } from "framer-motion";
import type { Difficulty } from "../poseEngine";

const MODEL_URL = "/human-workout.glb";

class ModelErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean}> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) { console.error("3D Model failed to load:", error); }
  render() {
    if (this.state.hasError) {
      return null; // Silently fail — background image will show instead
    }
    return this.props.children;
  }
}

function RealisticModel({ hovered }: { hovered: boolean }) {
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    const idleAction = actions["Idle"];
    const actionAction = actions["Action"];

    if (hovered) {
      actionAction?.reset().fadeIn(0.3).play();
      idleAction?.fadeOut(0.3);
    } else {
      idleAction?.reset().fadeIn(0.3).play();
      actionAction?.fadeOut(0.3);
    }
  }, [hovered, actions]);

  return <primitive object={scene} position={[0, -1, 0]} />;
}

// Removed preload to prevent hard crash if file is missing before user uploads it
// useGLTF.preload(MODEL_URL);

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; class: string; dots: number }> = {
  beginner: { label: "Beginner", class: "badge-beginner", dots: 1 },
  intermediate: { label: "Intermediate", class: "badge-intermediate", dots: 2 },
  advanced: { label: "Advanced", class: "badge-advanced", dots: 3 },
};

interface RealisticExerciseCardProps {
  exerciseId: string;
  exerciseName: string;
  description: string;
  demoUrl?: string;
  difficulty?: Difficulty;
  muscles?: string[];
  estimatedMinutes?: number;
  onClick?: () => void;
}

export function RealisticExerciseCard({ 
  exerciseName, description, demoUrl, 
  difficulty, muscles, estimatedMinutes, onClick
}: RealisticExerciseCardProps) {
  const [hovered, setHovered] = useState(false);
  const diffConfig = difficulty ? DIFFICULTY_CONFIG[difficulty] : null;

  return (
    <div onClick={onClick} className="block h-full cursor-pointer text-left w-full">
      <motion.div
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        className="exercise-card relative overflow-hidden rounded-2xl bg-[#0a0a0a] flex flex-col min-h-[440px] h-full border border-white/[0.06] group"
      >
        {/* Background Image */}
        {demoUrl && (
          <div className="absolute inset-0 overflow-hidden opacity-35 transition-all duration-700 group-hover:scale-110 group-hover:opacity-25 z-0">
            <img
              src={demoUrl}
              alt="Exercise preview"
              className="h-full w-full object-cover"
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
          </div>
        )}

        {/* 3D Canvas Layer */}
        <div className="absolute inset-0 pointer-events-none z-[1] threejs-canvas-container">
          <ModelErrorBoundary>
            <Canvas camera={{ position: [0, 1.5, 4], fov: 45 }}>
              <Suspense fallback={null}>
                <Environment preset="studio" />
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow color="#ffffff" />
                <spotLight position={[-5, 5, -5]} intensity={2} color="#22d3ee" angle={0.3} penumbra={1} />
                <RealisticModel hovered={hovered} />
              </Suspense>
            </Canvas>
          </ModelErrorBoundary>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent pointer-events-none z-[2]" />

        {/* Top badges */}
        <div className="relative z-[3] p-5 flex items-start justify-between">
          {diffConfig && (
            <span className={diffConfig.class}>
              <Signal size={10} />
              {diffConfig.label}
            </span>
          )}
          {estimatedMinutes && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/[0.05] text-slate-400 border border-white/[0.06]">
              <Clock size={10} />
              {estimatedMinutes} min
            </span>
          )}
        </div>

        {/* Bottom Content */}
        <div className="relative z-[3] p-6 pt-0 flex flex-col mt-auto">
          <div className="mb-5 transform transition-transform duration-500 group-hover:-translate-y-1">
            <h2 className="text-xl font-bold mb-2 transition-colors duration-300 group-hover:text-cyan-400 text-white">
              {exerciseName}
            </h2>
            <p className="text-sm text-slate-500 line-clamp-2 mb-3">
              {description}
            </p>
            
            {/* Muscle Pills */}
            {muscles && muscles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {muscles.slice(0, 3).map(m => (
                  <span key={m} className="muscle-pill">{m}</span>
                ))}
                {muscles.length > 3 && (
                  <span className="muscle-pill">+{muscles.length - 3}</span>
                )}
              </div>
            )}
          </div>
          
          <button className="shimmer-btn w-full py-3.5 bg-white/[0.04] text-white font-bold text-[11px] tracking-widest uppercase transition-all duration-500 group-hover:bg-cyan-400 group-hover:text-[#0a0a0a] group-hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] rounded-xl flex items-center justify-center gap-2 pointer-events-auto border border-white/[0.06]">
            <Play className="w-4 h-4 fill-current" />
            Start Session
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// =============================================================
// FormCheck — Module 2: usePoseTracker
// Owns the camera + MediaPipe Tasks Vision lifecycle.
// Modernized to ESM, Vite-compatible WebAssembly implementation.
// =============================================================
import { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Landmark } from "../exercises/poseEngine";

// Global cache to prevent re-downloading and re-compiling WebGL shaders across page navigations
let globalLandmarkerPromise: Promise<PoseLandmarker> | null = null;

async function getGlobalLandmarker(modelComplexity: number): Promise<PoseLandmarker> {
  if (globalLandmarkerPromise) return globalLandmarkerPromise;
  
  globalLandmarkerPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );

    const createOptions = {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${modelComplexity === 2 ? 'heavy' : modelComplexity === 1 ? 'full' : 'lite'}/float16/1/pose_landmarker_${modelComplexity === 2 ? 'heavy' : modelComplexity === 1 ? 'full' : 'lite'}.task`,
        delegate: "GPU" as const,
      },
      runningMode: "VIDEO" as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };

    try {
      return await PoseLandmarker.createFromOptions(vision, createOptions);
    } catch (gpuError) {
      console.warn("GPU pose landmarker setup failed, falling back to CPU delegate.", gpuError);
      return await PoseLandmarker.createFromOptions(vision, {
        ...createOptions,
        baseOptions: {
          ...createOptions.baseOptions,
          delegate: "CPU" as const,
        },
      });
    }
  })();
  
  return globalLandmarkerPromise;
}

export interface PoseFrame {
  landmarks: Landmark[] | null;
  results: PoseLandmarkerResult | null;
}

export interface UsePoseTrackerOptions {
  onFrame?: (frame: PoseFrame) => void;
  width?: number;
  height?: number;
  modelComplexity?: 0 | 1 | 2;
}

export interface UsePoseTrackerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  landmarks: Landmark[] | null;
  results: PoseLandmarkerResult | null;
  setupState: "idle" | "camera" | "model" | "ready";
  error: string | null;
  fps: number;
}

export function usePoseTracker(options: UsePoseTrackerOptions = {}): UsePoseTrackerReturn {
  const { onFrame, width = 640, height = 480, modelComplexity = 1 } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);

  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [results, setResults] = useState<PoseLandmarkerResult | null>(null);
  const [setupState, setSetupState] = useState<"idle" | "camera" | "model" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [lowResMode, setLowResMode] = useState(false);

  // FPS tracking refs
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(0);
  const lowFpsSecondsRef = useRef(0);

  useEffect(() => {
    lastFpsTimeRef.current = performance.now();
  }, []);

  // Initialization
  useEffect(() => {
    let cancelled = false;
    const activeVideoNode = videoRef.current; // Capture ref for safe cleanup

    // Frame Loop
    const renderLoop = async () => {
      if (cancelled || !activeVideoNode || !landmarkerRef.current) return;

      const video = activeVideoNode;
      
      // Process frame if video is playing and has new data
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        const startTimeMs = performance.now();
        
        const res = landmarkerRef.current.detectForVideo(video, startTimeMs);
        const lm = res.landmarks?.[0] as Landmark[] | undefined ?? null;

        // FPS calculation and Adaptive Resolution
        frameCountRef.current++;
        const now = performance.now();
        if (now - lastFpsTimeRef.current >= 1000) {
          const currentFps = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
          setFps(currentFps);
          
          if (currentFps < 24) {
             lowFpsSecondsRef.current += 1;
             if (lowFpsSecondsRef.current >= 3 && !lowResMode) {
                 console.warn("FPS dropped below 24 for 3s. Engaging Adaptive Resolution (downscaling).");
                 setLowResMode(true);
             }
          } else {
             lowFpsSecondsRef.current = 0;
          }
          
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;
        }

        setResults(res);
        setLandmarks(lm);
        try {
          onFrameRef.current?.({ landmarks: lm, results: res });
        } catch (err) {
          console.error("Error in onFrame callback:", err);
          // Do not throw, keep the loop alive
        }
      }
      
      if (!cancelled) {
        requestRef.current = requestAnimationFrame(renderLoop);
      }
    };

    const init = async () => {
      try {
        setSetupState("camera");
        
        // 1. Initialize Camera
        const effectiveWidth = lowResMode ? Math.floor(width / 2) : width;
        const effectiveHeight = lowResMode ? Math.floor(height / 2) : height;
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: effectiveWidth }, 
            height: { ideal: effectiveHeight },
            facingMode: "user" 
          },
          audio: false
        });

        if (cancelled || !activeVideoNode) return;
        activeVideoNode.srcObject = stream;
        
        await new Promise<void>((resolve) => {
          activeVideoNode.onloadeddata = () => resolve();
        });
        
        if (cancelled) return;

        setSetupState("model");

        // 2. Initialize MediaPipe Tasks Vision ESM using Global Cache
        const landmarker = await getGlobalLandmarker(modelComplexity);

        if (cancelled) return;
        
        landmarkerRef.current = landmarker;
        setSetupState("ready");
        
        // Start loop
        activeVideoNode.play();
        requestRef.current = requestAnimationFrame(renderLoop);
        
      } catch (err: unknown) {
        if (!cancelled) {
          console.error("usePoseTracker init error:", err);
          setError(err instanceof Error ? err.message : "Failed to initialize camera or model.");
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(requestRef.current);
      if (activeVideoNode && activeVideoNode.srcObject) {
        const stream = activeVideoNode.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      // We explicitly DO NOT call landmarker.close() here so we can reuse the GPU WebGL context on the next exercise
    };
  }, [width, height, modelComplexity, lowResMode]);

  return { videoRef, landmarks, results, setupState, error, fps };
}
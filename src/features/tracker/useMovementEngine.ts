import { useEffect, useRef, useState, useCallback } from "react";
import type { Landmark, ExerciseConfig } from "../exercises/poseEngine";
import { type FormBreakdown } from "../exercises/classifiers";
import { useTelemetryStore } from "./store";
import type { WorkerMessage, WorkerState } from "./engine.worker";
import { audioEngine } from "../../lib/audioEngine";

export interface EngineState {
  reps: number;
  stage: "up" | "down" | "in" | "out" | "rest";
  statusText: string;
  holdProgress: number; // 0 to 1
  holdElapsedSec: number;
  lastRepQuality: number | null; // 0 to 1
  averageRepQuality: number | null;
  formBreakdowns: FormBreakdown[];
}

export function useMovementEngine(exercise: ExerciseConfig) {
  const [state, setState] = useState<EngineState>({
    reps: 0,
    stage: "rest",
    statusText: "Ready",
    holdProgress: 0,
    holdElapsedSec: 0,
    lastRepQuality: null,
    averageRepQuality: null,
    formBreakdowns: []
  });

  const workerRef = useRef<Worker | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Web Speech API for audio cues
  const playAudioCue = useCallback((text: string, override = false) => {
    if (!("speechSynthesis" in window)) return;
    if (override) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  // Initialize Worker
  useEffect(() => {
    // create a new worker instance
    const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<{ type: string; state: WorkerState }>) => {
      const { type, state: wState } = e.data;
      if (type === 'STATE_UPDATE') {
        // Update fast telemetry via Zustand
        useTelemetryStore.getState().setTelemetry(
          wState.currentAngle, 
          wState.angleHistory, 
          wState.angularVelocity ?? null, 
          wState.powerOutput ?? null, 
          wState.holdProgress
        );

        // Update React state (throttled conceptually by react render batching)
        setState(prev => {
          if (
            prev.reps === wState.reps &&
            prev.stage === wState.stage &&
            prev.statusText === wState.statusText &&
            prev.holdProgress === wState.holdProgress &&
            prev.holdElapsedSec === wState.holdElapsedSec &&
            prev.lastRepQuality === wState.lastRepQuality &&
            prev.averageRepQuality === wState.averageRepQuality &&
            prev.formBreakdowns === wState.formBreakdowns
          ) {
            return prev;
          }
          return {
            reps: wState.reps,
            stage: wState.stage,
            statusText: wState.statusText,
            holdProgress: wState.holdProgress,
            holdElapsedSec: wState.holdElapsedSec,
            lastRepQuality: wState.lastRepQuality,
            averageRepQuality: wState.averageRepQuality,
            formBreakdowns: wState.formBreakdowns
          };
        });

        if (wState.audioCommand && !mutedRef.current) {
          playAudioCue(wState.audioCommand.text, wState.audioCommand.override);
        }
        
        if (wState.soundEffect && !mutedRef.current) {
          audioEngine.play(wState.soundEffect);
        }
      } else if (e.data.type === 'PONG') {
        // Heartbeat received
        // console.debug('Worker heartbeat:', e.data.timestamp);
      }
    };

    worker.postMessage({ type: 'INIT', exercise } as WorkerMessage);

    // Heartbeat ping interval
    const pingInterval = setInterval(() => {
      worker.postMessage({ type: 'PING' });
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      worker.terminate();
      workerRef.current = null;
      useTelemetryStore.getState().resetTelemetry();
    };
  }, [exercise]);

  // Sync mute state internally if needed, but audio plays from effect above
  useEffect(() => {
    // Just re-bind muted state to closure above
  }, [muted]);

  const processFrame = useCallback((landmarks: Landmark[]) => {
    workerRef.current?.postMessage({ type: 'FRAME', landmarks } as WorkerMessage);
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.postMessage({ type: 'RESET' } as WorkerMessage);
    useTelemetryStore.getState().resetTelemetry();
  }, []);

  return {
    ...state,
    processFrame,
    reset,
    muted,
    setMuted
  };
}

export function qualityStars(quality: number | null): string {
  if (quality === null) return "";
  if (quality >= 0.8) return "⭐⭐⭐";
  if (quality >= 0.5) return "⭐⭐";
  return "⭐";
}
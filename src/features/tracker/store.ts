import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface TelemetryState {
  currentAngle: number | null;
  angleHistory: number[];
  angularVelocity: number | null;
  powerOutput: number | null;
  holdProgress: number;
  setTelemetry: (currentAngle: number | null, angleHistory: number[], angularVelocity: number | null, powerOutput: number | null, holdProgress?: number) => void;
  resetTelemetry: () => void;
}

export const useTelemetryStore = create<TelemetryState>()(
  subscribeWithSelector((set) => ({
    currentAngle: null,
    angleHistory: [],
    angularVelocity: null,
    powerOutput: null,
    holdProgress: 0,
    setTelemetry: (currentAngle, angleHistory, angularVelocity, powerOutput, holdProgress = 0) => 
      set({ currentAngle, angleHistory, angularVelocity, powerOutput, holdProgress }),
    resetTelemetry: () => set({ currentAngle: null, angleHistory: [], angularVelocity: null, powerOutput: null, holdProgress: 0 }),
  }))
);

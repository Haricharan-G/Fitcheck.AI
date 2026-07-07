import { type Landmark } from "./poseEngine";

export interface BufferedFrame {
  landmarks: Landmark[];
  timestamp: number;
}

/**
 * A rolling buffer to store historical landmark data for time-series analysis.
 */
export class TrajectoryBuffer {
  private buffer: BufferedFrame[] = [];
  private maxDurationMs: number;

  constructor(maxDurationMs: number = 2000) {
    this.maxDurationMs = maxDurationMs;
  }

  addFrame(landmarks: Landmark[]) {
    const timestamp = performance.now();
    this.buffer.push({ landmarks, timestamp });
    
    // Purge old frames
    while (this.buffer.length > 0 && timestamp - this.buffer[0].timestamp > this.maxDurationMs) {
      this.buffer.shift();
    }
  }

  getFramesSince(startTimeMs: number): BufferedFrame[] {
    return this.buffer.filter(f => f.timestamp >= startTimeMs);
  }

  clear() {
    this.buffer = [];
  }
}

/**
 * Kinematic Classifiers
 * These act as heuristic ML decision trees operating on a time-series of frames.
 */

export interface FormBreakdown {
  type: "warning" | "error";
  message: string;
}

// Landmark Indices (MediaPipe)
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_KNEE = 25;
const RIGHT_KNEE = 26;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

/**
 * Detects if the hips rise significantly faster than the shoulders during an ascent (Squat "Good Morning")
 */
export function detectGoodMorningSquat(frames: BufferedFrame[]): FormBreakdown | null {
  if (frames.length < 5) return null;

  const first = frames[0].landmarks;
  const last = frames[frames.length - 1].landmarks;

  const getBestY = (lm: Landmark[], left: number, right: number) => {
    const lVis = lm[left].visibility ?? 0;
    const rVis = lm[right].visibility ?? 0;
    // Use the most visible side to prevent occluded limbs from breaking the math
    return lVis > rVis ? lm[left].y : lm[right].y;
  };

  const getHipsY = (lm: Landmark[]) => getBestY(lm, LEFT_HIP, RIGHT_HIP);
  const getShouldersY = (lm: Landmark[]) => getBestY(lm, LEFT_SHOULDER, RIGHT_SHOULDER);

  const startHips = getHipsY(first);
  const endHips = getHipsY(last);
  const startShoulders = getShouldersY(first);
  const endShoulders = getShouldersY(last);

  // Delta Y (negative means they moved up)
  const deltaHips = startHips - endHips; 
  const deltaShoulders = startShoulders - endShoulders;

  // If hips rose significantly more than shoulders, the chest collapsed forward
  if (deltaHips > deltaShoulders * 1.5 && deltaHips > 0.1) {
    return {
      type: "warning",
      message: "Hips rising too fast. Keep your chest up to avoid the 'Good Morning' squat."
    };
  }

  return null;
}

/**
 * Detects if the knees cave inwards relative to the ankles during ascent (Knee Valgus)
 */
export function detectKneeValgus(frames: BufferedFrame[]): FormBreakdown | null {
  if (frames.length < 5) return null;

  let minKneeDist = Infinity;
  let avgAnkleDist = 0;
  let validFrames = 0;

  for (const frame of frames) {
    const lm = frame.landmarks;
    // Check visibility
    if (lm[LEFT_KNEE].visibility && lm[LEFT_KNEE].visibility < 0.5) continue;
    if (lm[RIGHT_KNEE].visibility && lm[RIGHT_KNEE].visibility < 0.5) continue;

    const kneeDist = Math.abs(lm[LEFT_KNEE].x - lm[RIGHT_KNEE].x);
    const ankleDist = Math.abs(lm[LEFT_ANKLE].x - lm[RIGHT_ANKLE].x);

    minKneeDist = Math.min(minKneeDist, kneeDist);
    avgAnkleDist += ankleDist;
    validFrames++;
  }

  if (validFrames === 0) return null;
  avgAnkleDist /= validFrames;

  // If knees get much closer together than ankles (caving in)
  if (minKneeDist < avgAnkleDist * 0.6) {
    return {
      type: "error",
      message: "Knees caving inward. Push your knees out to align with your toes."
    };
  }

  return null;
}

/**
 * Runs a suite of kinematic classifiers on the upward phase of an exercise.
 */
export function evaluateConcentricPhase(exerciseId: string, frames: BufferedFrame[], durationMs: number): FormBreakdown[] {
  const breakdowns: FormBreakdown[] = [];
  if (frames.length < 2) return breakdowns;

  // Velocity-Based Training (VBT) Heuristics
  if (durationMs < 800) {
    breakdowns.push({
      type: "warning",
      message: "Rep too fast (loss of tension)"
    });
  } else if (durationMs > 3000) {
    breakdowns.push({
      type: "warning",
      message: "Rep grinding (reduce weight)"
    });
  }

  if (exerciseId === "squat") {
    const gm = detectGoodMorningSquat(frames);
    if (gm) breakdowns.push(gm);

    const valgus = detectKneeValgus(frames);
    if (valgus) breakdowns.push(valgus);
  }

  return breakdowns;
}

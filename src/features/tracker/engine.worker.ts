import {
  type ExerciseConfig,
  type Landmark,
  angleFromIndices,
  createAngleSmoother,
  tripletVisibility
} from "../exercises/poseEngine";
import { TrajectoryBuffer, evaluateConcentricPhase, type FormBreakdown } from "../exercises/classifiers";

// Worker types
export type WorkerMessage = 
  | { type: 'INIT'; exercise: ExerciseConfig }
  | { type: 'FRAME'; landmarks: Landmark[] }
  | { type: 'RESET' }
  | { type: 'PING' };

export interface WorkerState {
  currentAngle: number | null;
  angleHistory: number[];
  angularVelocity: number | null; // degrees per second
  powerOutput: number | null; // estimated relative power
  reps: number;
  stage: "up" | "down" | "in" | "out" | "rest";
  statusText: string;
  holdProgress: number;
  holdElapsedSec: number;
  lastRepQuality: number | null;
  averageRepQuality: number | null;
  formBreakdowns: FormBreakdown[];
  // Commands for the main thread to execute (like audio)
  audioCommand?: { text: string, delay: number, override: boolean };
  soundEffect?: "success" | "error" | "start";
}

// State container
let exercise: ExerciseConfig | null = null;
let smoother: ReturnType<typeof createAngleSmoother> | null = null;
let trajectoryBuffer: TrajectoryBuffer | null = null;

// Dynamic refs
let reps = 0;
let stage: "up" | "down" | "in" | "out" | "rest" = "rest";
let statusText = "Ready";
let lastRepQuality: number | null = null;
let qualitySum = 0;
let qualityCount = 0;
let formBreakdowns: FormBreakdown[] = [];
let activeLimbCache: "primary" | "alt" = "primary";
let angleHistory: number[] = [];
let timeHistory: number[] = [];
let lastStageChangeTime = 0;
let concentricStartTime = 0;

// Static refs
let accumulatedMs = 0;
let lastTs: number | null = null;
let lostSince: number | null = null;
let completed = false;
let lastValidFrameTime = 0;

function resetState() {
  reps = 0;
  stage = "rest";
  statusText = "Ready";
  activeLimbCache = "primary";
  lastRepQuality = null;
  qualitySum = 0;
  qualityCount = 0;
  formBreakdowns = [];
  angleHistory = [];
  timeHistory = [];
  lastStageChangeTime = 0;
  concentricStartTime = 0;
  
  accumulatedMs = 0;
  lastTs = null;
  lostSince = null;
  completed = false;
  
  if (smoother) smoother.reset();
  if (trajectoryBuffer) trajectoryBuffer.clear();
  
  postStateUpdate();
}

function calculateVelocity(): number | null {
  if (angleHistory.length < 5) return null;
  const dt = (timeHistory[timeHistory.length - 1] - timeHistory[0]) / 1000.0;
  if (dt <= 0) return 0;
  const dTheta = angleHistory[angleHistory.length - 1] - angleHistory[0];
  return dTheta / dt; // degrees per second
}

function postStateUpdate(audioCommand?: WorkerState['audioCommand'], soundEffect?: WorkerState['soundEffect']) {
  const vel = calculateVelocity();
  
  const state: WorkerState = {
    currentAngle: angleHistory.length > 0 ? angleHistory[angleHistory.length - 1] : null,
    angleHistory: [...angleHistory],
    angularVelocity: vel,
    powerOutput: vel ? Math.abs(vel) * 0.15 : null, // Mock power heuristic based on velocity magnitude
    reps,
    stage,
    statusText,
    holdProgress: exercise?.type === 'static' ? Math.min(1, accumulatedMs / (exercise.holdDurationSec * 1000)) : 0,
    holdElapsedSec: Math.round((accumulatedMs / 1000) * 10) / 10,
    lastRepQuality,
    averageRepQuality: qualityCount > 0 ? qualitySum / qualityCount : null,
    formBreakdowns,
    audioCommand,
    soundEffect
  };
  self.postMessage({ type: 'STATE_UPDATE', state });
}

function getActiveLimb(landmarks: Landmark[], primaryPts: readonly [number, number, number], altPts?: readonly [number, number, number]): readonly [number, number, number] {
  if (!altPts) return primaryPts;
  const pVis = tripletVisibility(landmarks, primaryPts);
  const aVis = tripletVisibility(landmarks, altPts);
  
  // If one side loses tracking completely, switch to the visible side
  if (pVis < 0.5 || aVis < 0.5) {
    if (aVis > pVis + 0.05) {
      activeLimbCache = "alt";
      return altPts;
    } else {
      activeLimbCache = "primary";
      return primaryPts;
    }
  }

  const restingAngle = (exercise && exercise.id === "shoulderPress") ? 90 : 180;
  const pAng = angleFromIndices(landmarks, primaryPts) ?? restingAngle;
  const aAng = angleFromIndices(landmarks, altPts) ?? restingAngle;
  
  const pDev = Math.abs(restingAngle - pAng);
  const aDev = Math.abs(restingAngle - aAng);
  
  // High hysteresis (20 degrees) to prevent micro-jitters when both limbs are near rest
  if (aDev > pDev + 20) {
    activeLimbCache = "alt";
    return altPts;
  }
  if (pDev > aDev + 20) {
    activeLimbCache = "primary";
    return primaryPts;
  }
  
  // Fallback to the previously active limb instead of visibility (which fluctuates)
  return activeLimbCache === "alt" ? altPts : primaryPts;
}

function processDynamic(landmarks: Landmark[]) {
  if (!exercise || exercise.type !== "dynamic" || !smoother || !trajectoryBuffer) return;
  const now = performance.now();

  const bestPrimary = getActiveLimb(landmarks, exercise.primaryAngle.points, exercise.primaryAngle.altPoints);
  const rawPrimary = angleFromIndices(landmarks, bestPrimary);
  const primaryConf = tripletVisibility(landmarks, bestPrimary);
  const primary = smoother.smoothWithConfidence(rawPrimary, primaryConf);
  
  const roundedAngle = primary == null ? null : Math.round(primary);
  if (roundedAngle !== null) {
      angleHistory.push(roundedAngle);
      timeHistory.push(now);
      if (angleHistory.length > 90) {
          angleHistory.shift();
          timeHistory.shift();
      }
  }
  
  // Save to high-fidelity buffer
  trajectoryBuffer.addFrame(landmarks);

  if (primary == null) {
      if (now - lastValidFrameTime > 2000 && stage !== "rest") {
          stage = "rest";
          statusText = "Resting (Subject Lost)";
      }
      postStateUpdate();
      return;
  }
  lastValidFrameTime = now;

  let audioCommand: WorkerState['audioCommand'] = undefined;
  let soundEffect: WorkerState['soundEffect'] = undefined;
  let s = statusText;

  if (stage === "rest" || stage === "up") {
      if (stage === "rest") {
          stage = "up"; // recover from rest
          s = "Ready";
      }
      if (primary <= exercise.stages.down.enterWhen.lte && now - lastStageChangeTime > exercise.dwellMs) {
        stage = "down";
        s = "Descending...";
        lastStageChangeTime = now;
        concentricStartTime = now;
        formBreakdowns = [];
        soundEffect = "start";
      }
  } else if (stage === "down" && primary >= exercise.stages.up.enterWhen.gte) {
    if (now - lastStageChangeTime > exercise.dwellMs) {
      stage = "up";
      s = "Up!";
      lastStageChangeTime = now;
      reps += 1;
      
      const concentricFrames = trajectoryBuffer.getFramesSince(concentricStartTime);
      const concentricDuration = now - concentricStartTime;
      formBreakdowns = evaluateConcentricPhase(exercise.id, concentricFrames, concentricDuration);
      
      const idealDepth = exercise.stages.down.enterWhen.lte;
      const actualDepth = Math.min(...angleHistory);
      const diff = Math.abs(actualDepth - idealDepth);
      if (diff <= 10) lastRepQuality = 1.0;
      else if (diff <= 25) lastRepQuality = 0.6;
      else lastRepQuality = 0.2;
      
      if (formBreakdowns.length > 0) {
          audioCommand = { text: formBreakdowns[0].message, delay: 0, override: true };
          soundEffect = "error";
          lastRepQuality = Math.min(lastRepQuality, 0.4);
      } else {
          soundEffect = "success";
      }

      qualitySum += lastRepQuality;
      qualityCount += 1;
    }
  }

  statusText = s;
  postStateUpdate(audioCommand, soundEffect);
}

function processStatic(landmarks: Landmark[]) {
  if (!exercise || exercise.type !== "static" || !smoother) return;
  const now = performance.now();
  const dt = lastTs == null ? 0 : now - lastTs;
  lastTs = now;

  if (dt > 200) return; // skip lag frames

  const bestPrimary = getActiveLimb(landmarks, exercise.primaryAngle.points, exercise.primaryAngle.altPoints);
  const rawPrimary = angleFromIndices(landmarks, bestPrimary);
  const primaryConf = tripletVisibility(landmarks, bestPrimary);
  const primary = smoother.smoothWithConfidence(rawPrimary, primaryConf);
  
  const roundedAngle = primary == null ? null : Math.round(primary);
  if (roundedAngle !== null) {
      angleHistory.push(roundedAngle);
      if (angleHistory.length > 90) angleHistory.shift();
  }

  const inPose = exercise.holdConditions.every((c) => {
    const bestPts = getActiveLimb(landmarks, c.points, c.altPoints);
    const a = angleFromIndices(landmarks, bestPts);
    return a != null && a >= c.min && a <= c.max;
  });

  const targetMs = exercise.holdDurationSec * 1000;
  let s = statusText;
  let audioCommand: WorkerState['audioCommand'] = undefined;
  let soundEffect: WorkerState['soundEffect'] = undefined;

  if (inPose) {
    lostSince = null;
    accumulatedMs += dt;
    if (accumulatedMs >= targetMs && !completed) {
      completed = true;
      reps += 1;
      lastRepQuality = 1.0;
      audioCommand = { text: exercise.feedback.complete, delay: 0, override: true };
      soundEffect = "success";
      accumulatedMs = 0;
      setTimeout(() => { completed = false; }, 1500);
    } else if (!completed) {
      s = exercise.feedback.holding;
    }
  } else {
    if (lostSince == null) lostSince = now;
    if (now - lostSince > exercise.toleranceMs) {
      const drain = dt * exercise.decayRate;
      accumulatedMs = Math.max(0, accumulatedMs - drain);
      if (accumulatedMs <= 0) {
        if (now - lostSince > 3000) {
            stage = "rest";
            s = "Resting (Subject Lost)";
        } else {
            s = exercise.feedback.lost;
        }
      } else {
        s = "Hold breaking...";
      }
    }
  }
  
  if (primary != null) {
      lastValidFrameTime = now;
      if (stage === "rest") stage = "out"; // recover
  }

  statusText = s;
  if (stage !== "rest") {
      stage = inPose ? "in" : "out";
  }
  postStateUpdate(audioCommand, soundEffect);
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  if (msg.type === 'INIT') {
    exercise = msg.exercise;
    smoother = createAngleSmoother(0.15);
    trajectoryBuffer = new TrajectoryBuffer(3000);
    resetState();
  } else if (msg.type === 'RESET') {
    resetState();
  } else if (msg.type === 'FRAME') {
    if (exercise?.type === 'dynamic') processDynamic(msg.landmarks);
    else processStatic(msg.landmarks);
  } else if (msg.type === 'PING') {
    self.postMessage({ type: 'PONG', timestamp: performance.now() });
  }
};

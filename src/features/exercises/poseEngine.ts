// =============================================================
// FormCheck — Module 1: Math & Config Utilities
// Single source of truth. No exercise logic lives outside this file.
// =============================================================

/** A single MediaPipe Pose landmark (normalized 0..1 coords). */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** Canonical MediaPipe Pose landmark indices we use. */
export const POSE = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

// ── Exercise categories ──
export type ExerciseCategory = "strength" | "yoga" | "stretching";

export const CATEGORY_META: Record<
  ExerciseCategory,
  { label: string; color: string; modelComplexity: 0 | 1 | 2 }
> = {
  strength: { label: "Strength", color: "amber", modelComplexity: 2 },
  yoga: { label: "Yoga", color: "violet", modelComplexity: 2 },
  stretching: { label: "Stretching", color: "emerald", modelComplexity: 2 },
};

// ═══════════════════════════════════════════════════════════════
// MATH UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Interior angle (degrees) at vertex `b`, formed by a–b–c.
 * Uses full 3D spatial coordinates (x, y, z) for accurate kinematics
 * independent of camera angle. Returns 0..180.
 */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  // Vector BA
  const ba_x = a.x - b.x;
  const ba_y = a.y - b.y;
  
  // Vector BC
  const bc_x = c.x - b.x;
  const bc_y = c.y - b.y;
  
  // Dot product
  const dotProduct = (ba_x * bc_x) + (ba_y * bc_y);
  
  // Magnitudes
  const magBA = Math.sqrt(ba_x * ba_x + ba_y * ba_y);
  const magBC = Math.sqrt(bc_x * bc_x + bc_y * bc_y);
  
  // Angle
  if (magBA * magBC === 0) return 0;
  
  // Clamp due to floating point precision issues near exactly 1 or -1
  const cosineAngle = Math.max(-1.0, Math.min(1.0, dotProduct / (magBA * magBC)));
  
  const angle = Math.acos(cosineAngle) * (180.0 / Math.PI);
  return angle;
}

/**
 * Average visibility of a triplet of landmarks. Returns 0..1.
 */
export function tripletVisibility(
  landmarks: Landmark[],
  points: readonly [number, number, number]
): number {
  const [ai, bi, ci] = points;
  const a = landmarks[ai];
  const b = landmarks[bi];
  const c = landmarks[ci];
  if (!a || !b || !c) return 0;
  return ((a.visibility ?? 0) + (b.visibility ?? 0) + (c.visibility ?? 0)) / 3;
}

/**
 * Resolve an angle from landmark indices.
 * Returns null if any landmark is missing or below minVisibility.
 */
export function angleFromIndices(
  landmarks: Landmark[],
  points: readonly [number, number, number],
  minVisibility = 0.4
): number | null {
  const [ai, bi, ci] = points;
  const a = landmarks[ai];
  const b = landmarks[bi];
  const c = landmarks[ci];

  if (!a || !b || !c) return null;
  if (
    (a.visibility ?? 1) < minVisibility ||
    (b.visibility ?? 1) < minVisibility ||
    (c.visibility ?? 1) < minVisibility
  ) {
    return null;
  }
  return calculateAngle(a, b, c);
}

/**
 * Pick the best side (primary vs alt) based on landmark visibility.
 * Returns the points triplet with higher average visibility.
 */
export function pickBestSide(
  landmarks: Landmark[],
  primary: readonly [number, number, number],
  alt?: readonly [number, number, number]
): readonly [number, number, number] {
  if (!alt) return primary;
  const pVis = tripletVisibility(landmarks, primary);
  const aVis = tripletVisibility(landmarks, alt);
  return aVis > pVis + 0.05 ? alt : primary; // 5% hysteresis to prevent flip-flop
}

// ═══════════════════════════════════════════════════════════════
// ANGLE SMOOTHER (Exponential Moving Average)
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a per-channel EMA angle smoother.
 * `alpha` controls responsiveness: 0.2 = very smooth, 0.5 = responsive.
 */
export function createAngleSmoother(alpha = 0.35) {
  let prev: number | null = null;
  let nullCount = 0;

  return {
    /** Feed a raw angle and get a smoothed value. */
    smooth(raw: number | null): number | null {
      if (raw === null) {
        nullCount++;
        if (nullCount > 5) {
          prev = null; // Lost tracking — reset smoother
        }
        return prev; // Return last known while briefly occluded
      }
      nullCount = 0;
      if (prev === null) {
        prev = raw;
        return raw;
      }
      prev = prev + alpha * (raw - prev);
      return prev;
    },

    /** Adapt alpha based on confidence: lower confidence → heavier smoothing. */
    smoothWithConfidence(raw: number | null, confidence: number): number | null {
      if (raw === null) return this.smooth(null);
      // Graduated: low confidence (0.4–0.6) → alpha*0.5, high (0.8+) → full alpha
      const adaptedAlpha = alpha * Math.min(1, Math.max(0.4, (confidence - 0.3) / 0.5));
      nullCount = 0;
      if (prev === null) {
        prev = raw;
        return raw;
      }
      prev = prev + adaptedAlpha * (raw - prev);
      return prev;
    },

    /** Reset the smoother state. */
    reset() {
      prev = null;
      nullCount = 0;
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// BODY ORIENTATION DETECTION
// ═══════════════════════════════════════════════════════════════

export type BodyOrientation = "front" | "side" | "unknown";

/**
 * Detect if user is facing camera (front) or standing sideways (side).
 * Based on how wide shoulders appear in normalized X.
 */
export function getBodyOrientation(landmarks: Landmark[]): BodyOrientation {
  const ls = landmarks[POSE.LEFT_SHOULDER];
  const rs = landmarks[POSE.RIGHT_SHOULDER];
  if (!ls || !rs) return "unknown";
  if ((ls.visibility ?? 0) < 0.4 || (rs.visibility ?? 0) < 0.4) return "unknown";
  const shoulderWidth = Math.abs(ls.x - rs.x);
  if (shoulderWidth < 0.06) return "side";
  if (shoulderWidth > 0.15) return "front";
  return "unknown";
}

/**
 * Whether an exercise works best from a side view.
 * Push-ups, forward folds, etc. need side orientation for accurate 2D angles.
 */
export function exerciseNeedsSideView(exerciseId: string): boolean {
  const sideViewExercises = new Set([
    "pushUp",
    "bicepCurl",
    "shoulderPress",
    "hamstringStretch",
    "forwardFold",
    "overheadStretch",
  ]);
  return sideViewExercises.has(exerciseId);
}

// ═══════════════════════════════════════════════════════════════
// EXERCISE CONFIGURATION TYPES
// ═══════════════════════════════════════════════════════════════

export interface AngleDef {
  name: string;
  points: readonly [number, number, number];
  altPoints?: readonly [number, number, number]; // Mirror side
}

export interface AngleConstraint extends AngleDef {
  min: number;
  max: number;
}

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface BaseExercise {
  id: string;
  name: string;
  emoji: string;
  category: ExerciseCategory;
  target: string;
  primaryAngle: AngleDef;
  demoUrl?: string;
  videoUrl?: string;
  perfectAngle?: number;
  difficulty: Difficulty;
  muscles: string[];
  estimatedMinutes: number;
  instructions: string[];
}

export interface DynamicExercise extends BaseExercise {
  type: "dynamic";
  stages: {
    up: { enterWhen: { gte: number } };
    down: { enterWhen: { lte: number } };
  };
  repTransition: { from: "down" | "up"; to: "down" | "up" };
  goodDepthBelow: number;
  dwellMs: number; // Min time in stage before transition counts
  feedback: {
    down: string;
    up: string;
    tooShallow: string;
  };
}

export interface StaticExercise extends BaseExercise {
  type: "static";
  holdConditions: AngleConstraint[];
  holdDurationSec: number;
  toleranceMs: number;
  decayRate: number; // Multiplier for hold drain when out of pose (e.g. 2.0)
  feedback: {
    holding: string;
    complete: string;
    lost: string;
  };
}

export type ExerciseConfig = DynamicExercise | StaticExercise;

function getExerciseDemoUrl(exerciseId: string): string {
  const images: Record<string, string> = {
    squat: "/demos/squat.png",
    pushUp: "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?q=80&w=1469&auto=format&fit=crop",
    lunge: "/demos/lunge.avif",
    bicepCurl: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=1470&auto=format&fit=crop",
    shoulderPress: "/demos/shoulder press.jpeg",
    deadlift: "/demos/Deadlift.jpeg",
    gluteBridge: "/demos/Glute Bridge.jpeg",
    birdDog: "/demos/bird dog.png",
    plank: "/demos/plank.jpeg",
    treePose: "/demos/Tree Pose.jpeg",
    warriorII: "/demos/Warrior II.jpeg",
    trianglePose: "/demos/Triangle Pose.jpeg",
    chairPose: "/demos/Chair Pose.jpeg",
    downwardDog: "/demos/Downward Dog.jpeg",
    cobraPose: "/demos/cobra pose.jpeg",
    overheadStretch: "/demos/overhead stretch.jpeg",
    sideBend: "/demos/Side Bend.jpeg",
    hamstringStretch: "/demos/Hamstring Stretch.jpeg",
    forwardFold: "/demos/Forward Fold.jpeg",
  };

  if (images[exerciseId]) {
    return images[exerciseId];
  }
  
  return "/demos/squat.png";
}

function getExerciseVideoUrl(exerciseId: string): string {
  const exerciseVideos: Record<string, string> = {
    squat: "https://www.youtube.com/embed/UXJrBgI2RxA?rel=0",
    pushUp: "https://www.youtube.com/embed/IODxDxX7oi4?rel=0",
    lunge: "https://www.youtube.com/embed/2sXkru7jmWg?rel=0",
    bicepCurl: "https://www.youtube.com/embed/2pL8s2U64cI?rel=0",
    shoulderPress: "https://www.youtube.com/embed/4Uf0m6kdz6A?rel=0",
    deadlift: "https://www.youtube.com/embed/R0nifuY91Hw?rel=0",
    gluteBridge: "https://www.youtube.com/embed/8bbE64NuDTU?rel=0",
    birdDog: "https://www.youtube.com/embed/0vYDx5AZM3s?rel=0",
    plank: "https://www.youtube.com/embed/pSHjTRCQxIw?rel=0",
    treePose: "https://www.youtube.com/embed/W2zL3D0ybnw?rel=0",
    warriorII: "https://www.youtube.com/embed/M4S7fM0AsB0?rel=0",
    trianglePose: "https://www.youtube.com/embed/mB2mX1QGb6g?rel=0",
    chairPose: "https://www.youtube.com/embed/J4vFQaJ3nQk?rel=0",
    downwardDog: "https://www.youtube.com/embed/y6wD4c0t0Tw?rel=0",
    cobraPose: "https://www.youtube.com/embed/GfpegX5iKwk?rel=0",
    overheadStretch: "https://www.youtube.com/embed/gJ3sYl6SkJ0?rel=0",
    sideBend: "https://www.youtube.com/embed/eX3jeV2gw5E?rel=0",
    hamstringStretch: "https://www.youtube.com/embed/j5Vw6GzKLj4?rel=0",
    forwardFold: "https://www.youtube.com/embed/P6M0Q9xHZ0M?rel=0",
  };

  return exerciseVideos[exerciseId] ?? "https://www.youtube.com/embed/UXJrBgI2RxA?rel=0";
}

// ═══════════════════════════════════════════════════════════════
// EXERCISE SCHEMA
// ═══════════════════════════════════════════════════════════════
export const EXERCISE_SCHEMA: Record<string, ExerciseConfig> = {
  // ── STRENGTH ──
  squat: {
    id: "squat",
    name: "Squat",
    emoji: "🏋️",
    category: "strength",
    target: "Quads · Glutes · Core",
    demoUrl: getExerciseDemoUrl("squat"),
    videoUrl: getExerciseVideoUrl("squat"),
    perfectAngle: 85,
    difficulty: "beginner",
    muscles: ["Quadriceps", "Glutes", "Core", "Hamstrings"],
    estimatedMinutes: 8,
    instructions: ["Stand with feet shoulder-width apart", "Keep chest up and back straight", "Lower until thighs are parallel to floor", "Drive through heels to stand"],
    type: "dynamic",
    primaryAngle: {
      name: "Knee",
      points: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
      altPoints: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
    },
    stages: {
      up: { enterWhen: { gte: 160 } },
      down: { enterWhen: { lte: 95 } },
    },
    repTransition: { from: "down", to: "up" },
    goodDepthBelow: 100,
    dwellMs: 120,
    feedback: {
      down: "Good depth!",
      up: "Nice rep!",
      tooShallow: "Go a little deeper next time.",
    },
  },

  pushUp: {
    id: "pushUp",
    name: "Push-Up",
    emoji: "💪",
    category: "strength",
    target: "Chest · Shoulders · Triceps",
    demoUrl: getExerciseDemoUrl("pushUp"),
    videoUrl: getExerciseVideoUrl("pushUp"),
    perfectAngle: 90,
    difficulty: "intermediate",
    muscles: ["Chest", "Triceps", "Shoulders", "Core"],
    estimatedMinutes: 6,
    instructions: ["Place hands slightly wider than shoulder-width", "Keep body in a straight line", "Lower chest to near the floor", "Push back up to full extension"],
    type: "dynamic",
    primaryAngle: {
      name: "Elbow",
      points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW, POSE.RIGHT_WRIST],
      altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW, POSE.LEFT_WRIST],
    },
    stages: {
      up: { enterWhen: { gte: 160 } },
      down: { enterWhen: { lte: 90 } },
    },
    repTransition: { from: "down", to: "up" },
    goodDepthBelow: 85,
    dwellMs: 100,
    feedback: {
      down: "Good depth!",
      up: "Nice push!",
      tooShallow: "Go lower!",
    },
  },

  lunge: {
    id: "lunge",
    name: "Lunge",
    emoji: "🦵",
    category: "strength",
    target: "Quads · Glutes · Hamstrings",
    demoUrl: getExerciseDemoUrl("lunge"),
    videoUrl: getExerciseVideoUrl("lunge"),
    difficulty: "beginner",
    muscles: ["Quadriceps", "Glutes", "Hamstrings", "Calves"],
    estimatedMinutes: 7,
    instructions: ["Step forward with one leg", "Lower back knee toward the ground", "Keep front knee over ankle", "Push through front heel to return"],
    type: "dynamic",
    primaryAngle: {
      name: "Front Knee",
      points: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
      altPoints: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
    },
    stages: {
      up: { enterWhen: { gte: 160 } },
      down: { enterWhen: { lte: 100 } },
    },
    repTransition: { from: "down", to: "up" },
    goodDepthBelow: 95,
    dwellMs: 120,
    feedback: {
      down: "Great lunge depth!",
      up: "Strong drive up!",
      tooShallow: "Drop that back knee a bit more.",
    },
  },

  bicepCurl: {
    id: "bicepCurl",
    name: "Bicep Curl",
    emoji: "💪",
    category: "strength",
    target: "Biceps · Forearms",
    demoUrl: getExerciseDemoUrl("bicepCurl"),
    videoUrl: getExerciseVideoUrl("bicepCurl"),
    perfectAngle: 45,
    difficulty: "beginner",
    muscles: ["Biceps", "Forearms", "Brachialis"],
    estimatedMinutes: 5,
    instructions: ["Stand with arms at your sides", "Keep elbows close to your body", "Curl weights toward shoulders", "Slowly lower back down with control"],
    type: "dynamic",
    primaryAngle: {
      name: "Elbow",
      points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW, POSE.RIGHT_WRIST],
      altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW, POSE.LEFT_WRIST],
    },
    stages: {
      up: { enterWhen: { gte: 150 } },
      down: { enterWhen: { lte: 70 } },
    },
    repTransition: { from: "down", to: "up" },
    goodDepthBelow: 45,
    dwellMs: 80,
    feedback: {
      down: "Full contraction!",
      up: "Good extension!",
      tooShallow: "Curl all the way up.",
    },
  },

  shoulderPress: {
    id: "shoulderPress",
    name: "Shoulder Press",
    emoji: "🙌",
    category: "strength",
    target: "Deltoids · Triceps · Traps",
    demoUrl: getExerciseDemoUrl("shoulderPress"),
    videoUrl: getExerciseVideoUrl("shoulderPress"),
    difficulty: "intermediate",
    muscles: ["Deltoids", "Triceps", "Trapezius", "Core"],
    estimatedMinutes: 6,
    instructions: ["Hold weights at shoulder height", "Press overhead until arms are fully extended", "Keep core engaged throughout", "Lower back to shoulder height with control"],
    type: "dynamic",
    primaryAngle: {
      name: "Elbow",
      points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW, POSE.RIGHT_WRIST],
      altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW, POSE.LEFT_WRIST],
    },
    stages: {
      up: { enterWhen: { gte: 160 } },
      down: { enterWhen: { lte: 90 } },
    },
    repTransition: { from: "down", to: "up" },
    goodDepthBelow: 85,
    dwellMs: 100,
    feedback: {
      down: "Elbows at 90°—good!",
      up: "Full press! Great form.",
      tooShallow: "Press all the way up.",
    },
  },

  deadlift: {
    id: "deadlift",
    name: "Deadlift",
    emoji: "🏋️‍♂️",
    category: "strength",
    target: "Hamstrings · Glutes · Lower Back",
    demoUrl: getExerciseDemoUrl("deadlift"),
    videoUrl: getExerciseVideoUrl("deadlift"),
    difficulty: "advanced",
    muscles: ["Hamstrings", "Glutes", "Lower Back", "Traps"],
    estimatedMinutes: 10,
    instructions: ["Stand with feet hip-width apart over the bar", "Hinge at hips keeping back flat", "Grip the bar just outside knees", "Drive hips forward to full lockout"],
    type: "dynamic",
    primaryAngle: {
      name: "Hip Hinge",
      points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP, POSE.RIGHT_KNEE],
      altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_HIP, POSE.LEFT_KNEE],
    },
    stages: {
      up: { enterWhen: { gte: 160 } },
      down: { enterWhen: { lte: 110 } },
    },
    repTransition: { from: "down", to: "up" },
    goodDepthBelow: 105,
    dwellMs: 120,
    feedback: {
      down: "Good hinge!",
      up: "Full lockout!",
      tooShallow: "Hinge a bit deeper.",
    },
  },

  gluteBridge: {
    id: "gluteBridge",
    name: "Glute Bridge",
    emoji: "🍑",
    category: "strength",
    target: "Glutes · Hamstrings",
    demoUrl: getExerciseDemoUrl("gluteBridge"),
    videoUrl: getExerciseVideoUrl("gluteBridge"),
    difficulty: "beginner",
    muscles: ["Glutes", "Hamstrings", "Core"],
    estimatedMinutes: 5,
    instructions: ["Lie on your back with knees bent and feet flat on the floor", "Keep feet hip-width apart", "Push through heels to lift hips until body is in a straight line from shoulders to knees", "Squeeze glutes at the top, then slowly lower"],
    type: "dynamic",
    primaryAngle: {
      name: "Hip Extension",
      points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP, POSE.RIGHT_KNEE],
      altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_HIP, POSE.LEFT_KNEE],
    },
    stages: {
      up: { enterWhen: { gte: 165 } },
      down: { enterWhen: { lte: 130 } },
    },
    repTransition: { from: "down", to: "up" },
    goodDepthBelow: 140,
    dwellMs: 150,
    feedback: {
      down: "Rest at bottom.",
      up: "Great hip extension!",
      tooShallow: "Push hips higher to form a straight line.",
    },
  },

  birdDog: {
    id: "birdDog",
    name: "Bird Dog",
    emoji: "🐕",
    category: "stretching",
    target: "Core · Lower Back · Balance",
    demoUrl: getExerciseDemoUrl("birdDog"),
    videoUrl: getExerciseVideoUrl("birdDog"),
    difficulty: "beginner",
    muscles: ["Core", "Erector Spinae", "Glutes", "Shoulders"],
    estimatedMinutes: 4,
    instructions: ["Start on all fours with hands under shoulders and knees under hips", "Extend opposite arm and leg straight out", "Keep your back flat and core engaged", "Hold briefly, then return to start"],
    type: "dynamic",
    primaryAngle: {
      name: "Shoulder Flexion",
      points: [POSE.RIGHT_HIP, POSE.RIGHT_SHOULDER, POSE.RIGHT_WRIST],
      altPoints: [POSE.LEFT_HIP, POSE.LEFT_SHOULDER, POSE.LEFT_WRIST],
    },
    stages: {
      up: { enterWhen: { gte: 160 } },
      down: { enterWhen: { lte: 90 } },
    },
    repTransition: { from: "down", to: "up" },
    goodDepthBelow: 100,
    dwellMs: 200,
    feedback: {
      down: "Return to start.",
      up: "Nice extension and balance!",
      tooShallow: "Reach arm fully forward.",
    },
  },

  plank: {
    id: "plank",
    name: "Plank",
    emoji: "🪵",
    category: "strength",
    target: "Core · Shoulders",
    demoUrl: getExerciseDemoUrl("plank"),
    videoUrl: getExerciseVideoUrl("plank"),
    perfectAngle: 180,
    difficulty: "intermediate",
    muscles: ["Core", "Shoulders", "Glutes", "Back"],
    estimatedMinutes: 3,
    instructions: ["Place forearms on the floor shoulder-width apart", "Extend legs behind you on your toes", "Keep body in a straight line from head to heels", "Engage core and hold without sagging"],
    type: "static",
    primaryAngle: {
      name: "Body Alignment",
      points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP, POSE.RIGHT_ANKLE],
      altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_HIP, POSE.LEFT_ANKLE],
    },
    holdConditions: [
      {
        name: "Straight Body",
        points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP, POSE.RIGHT_ANKLE],
        altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_HIP, POSE.LEFT_ANKLE],
        min: 160,
        max: 185,
      }
    ],
    holdDurationSec: 30,
    toleranceMs: 600,
    decayRate: 1.5,
    feedback: {
      holding: "Keep your core tight and body straight.",
      complete: "Great plank hold!",
      lost: "Don't let your hips sag or rise.",
    },
  },

  // ── YOGA ──
  treePose: {
    id: "treePose",
    name: "Tree Pose",
    emoji: "🌳",
    category: "yoga",
    target: "Balance · Core · Ankles",
    demoUrl: getExerciseDemoUrl("treePose"),
    videoUrl: getExerciseVideoUrl("treePose"),
    difficulty: "beginner",
    muscles: ["Core", "Ankles", "Glutes", "Inner Thigh"],
    estimatedMinutes: 3,
    instructions: ["Stand on one leg with foot pressed into inner thigh", "Bring hands to prayer position or overhead", "Fix gaze on a steady point", "Breathe steadily and hold"],
    type: "static",
    primaryAngle: {
      name: "Raised Knee",
      points: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
      altPoints: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
    },
    holdConditions: [
      {
        name: "Raised Knee",
        points: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
        altPoints: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
        min: 25,
        max: 85,
      },
      {
        name: "Standing Knee",
        points: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
        altPoints: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
        min: 160,
        max: 185,
      },
    ],
    holdDurationSec: 10,
    toleranceMs: 600,
    decayRate: 1.5,
    feedback: {
      holding: "Hold steady — breathe.",
      complete: "Great hold — pose complete!",
      lost: "Find your balance and reset.",
    },
  },

  warriorII: {
    id: "warriorII",
    name: "Warrior II",
    emoji: "⚔️",
    category: "yoga",
    target: "Hips · Legs · Shoulders",
    demoUrl: getExerciseDemoUrl("warriorII"),
    videoUrl: getExerciseVideoUrl("warriorII"),
    perfectAngle: 90,
    difficulty: "intermediate",
    muscles: ["Quadriceps", "Glutes", "Shoulders", "Hip Flexors"],
    estimatedMinutes: 4,
    instructions: ["Step feet wide apart, front foot forward", "Bend front knee to 90 degrees", "Extend arms parallel to the floor", "Gaze over front fingertips"],
    type: "static",
    primaryAngle: {
      name: "Front Knee",
      points: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
      altPoints: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
    },
    holdConditions: [
      {
        name: "Front Knee",
        points: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
        altPoints: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
        min: 75,
        max: 110,
      },
      {
        name: "Back Leg",
        points: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
        altPoints: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
        min: 155,
        max: 185,
      },
    ],
    holdDurationSec: 15,
    toleranceMs: 600,
    decayRate: 1.5,
    feedback: {
      holding: "Strong warrior — hold the stance.",
      complete: "Warrior II complete!",
      lost: "Straighten your back leg and bend the front knee.",
    },
  },

  trianglePose: {
    id: "trianglePose",
    name: "Triangle Pose",
    emoji: "📐",
    category: "yoga",
    target: "Hamstrings · Core · Spine",
    demoUrl: getExerciseDemoUrl("trianglePose"),
    videoUrl: getExerciseVideoUrl("trianglePose"),
    perfectAngle: 180,
    difficulty: "intermediate",
    muscles: ["Hamstrings", "Core", "Spine", "Obliques"],
    estimatedMinutes: 4,
    instructions: ["Step feet wide apart, front foot forward", "Keep both legs straight", "Reach down toward front ankle", "Extend opposite arm straight up"],
    type: "static",
    primaryAngle: {
      name: "Front Knee",
      points: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
      altPoints: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
    },
    holdConditions: [
      {
        name: "Front Leg Straight",
        points: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
        altPoints: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
        min: 165,
        max: 185,
      },
      {
        name: "Back Leg Straight",
        points: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
        altPoints: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
        min: 165,
        max: 185,
      },
      {
        name: "Torso Lean",
        points: [POSE.LEFT_HIP, POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW],
        altPoints: [POSE.RIGHT_HIP, POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW],
        min: 75,
        max: 110,
      }
    ],
    holdDurationSec: 15,
    toleranceMs: 600,
    decayRate: 1.5,
    feedback: {
      holding: "Open your chest, reach towards the sky.",
      complete: "Triangle pose complete!",
      lost: "Keep both legs straight and lean to the side.",
    },
  },

  chairPose: {
    id: "chairPose",
    name: "Chair Pose",
    emoji: "🪑",
    category: "yoga",
    target: "Quads · Glutes · Core · Shoulders",
    demoUrl: getExerciseDemoUrl("chairPose"),
    videoUrl: getExerciseVideoUrl("chairPose"),
    difficulty: "intermediate",
    muscles: ["Quadriceps", "Glutes", "Core", "Shoulders"],
    estimatedMinutes: 3,
    instructions: ["Stand with feet together", "Bend knees as if sitting in a chair", "Raise arms overhead alongside ears", "Keep weight in your heels"],
    type: "static",
    primaryAngle: {
      name: "Knee",
      points: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
      altPoints: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
    },
    holdConditions: [
      {
        name: "Knee Bend",
        points: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
        altPoints: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
        min: 90,
        max: 140,
      },
      {
        name: "Arms Up",
        points: [POSE.RIGHT_HIP, POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW],
        altPoints: [POSE.LEFT_HIP, POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW],
        min: 150,
        max: 185,
      },
    ],
    holdDurationSec: 12,
    toleranceMs: 500,
    decayRate: 1.8,
    feedback: {
      holding: "Sit deeper — keep your arms lifted.",
      complete: "Chair Pose complete! Well done.",
      lost: "Bend your knees and raise your arms.",
    },
  },

  downwardDog: {
    id: "downwardDog",
    name: "Downward Dog",
    emoji: "🐕",
    category: "yoga",
    target: "Hamstrings · Shoulders",
    demoUrl: getExerciseDemoUrl("downwardDog"),
    difficulty: "beginner",
    muscles: ["Hamstrings", "Shoulders", "Calves", "Back"],
    estimatedMinutes: 3,
    instructions: ["Start on hands and knees", "Lift hips up and back forming an inverted V", "Press heels toward the floor", "Keep arms straight and head between upper arms"],
    type: "static",
    primaryAngle: {
      name: "Hip Fold",
      points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP, POSE.RIGHT_ANKLE],
      altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_HIP, POSE.LEFT_ANKLE],
    },
    holdConditions: [
      {
        name: "Inverted V",
        points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP, POSE.RIGHT_ANKLE],
        altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_HIP, POSE.LEFT_ANKLE],
        min: 60,
        max: 120,
      },
      {
        name: "Straight Arms",
        points: [POSE.RIGHT_HIP, POSE.RIGHT_SHOULDER, POSE.RIGHT_WRIST],
        altPoints: [POSE.LEFT_HIP, POSE.LEFT_SHOULDER, POSE.LEFT_WRIST],
        min: 150,
        max: 185,
      }
    ],
    holdDurationSec: 15,
    toleranceMs: 600,
    decayRate: 1.5,
    feedback: {
      holding: "Press your heels down and lift your hips.",
      complete: "Downward dog complete!",
      lost: "Keep your arms straight and hips high.",
    },
  },

  cobraPose: {
    id: "cobraPose",
    name: "Cobra Pose",
    emoji: "🐍",
    category: "yoga",
    target: "Lower Back · Chest",
    demoUrl: getExerciseDemoUrl("cobraPose"),
    videoUrl: getExerciseVideoUrl("cobraPose"),
    difficulty: "beginner",
    muscles: ["Lower Back", "Chest", "Shoulders", "Abs"],
    estimatedMinutes: 3,
    instructions: ["Lie face down with palms near shoulders", "Press upper body up keeping hips on floor", "Roll shoulders back and down", "Hold with gentle backbend"],
    type: "static",
    primaryAngle: {
      name: "Spine Extension",
      points: [POSE.RIGHT_KNEE, POSE.RIGHT_HIP, POSE.RIGHT_SHOULDER],
      altPoints: [POSE.LEFT_KNEE, POSE.LEFT_HIP, POSE.LEFT_SHOULDER],
    },
    holdConditions: [
      {
        name: "Chest Lifted",
        points: [POSE.RIGHT_KNEE, POSE.RIGHT_HIP, POSE.RIGHT_SHOULDER],
        altPoints: [POSE.LEFT_KNEE, POSE.LEFT_HIP, POSE.LEFT_SHOULDER],
        min: 120,
        max: 160,
      }
    ],
    holdDurationSec: 15,
    toleranceMs: 600,
    decayRate: 1.5,
    feedback: {
      holding: "Lift your chest, keep shoulders down.",
      complete: "Cobra pose complete!",
      lost: "Keep your hips on the floor and lift your chest.",
    },
  },

  // ── STRETCHING ──
  overheadStretch: {
    id: "overheadStretch",
    name: "Overhead Stretch",
    emoji: "🙆",
    category: "stretching",
    target: "Shoulders · Lats · Spine",
    demoUrl: getExerciseDemoUrl("overheadStretch"),
    videoUrl: getExerciseVideoUrl("overheadStretch"),
    difficulty: "beginner",
    muscles: ["Shoulders", "Lats", "Spine", "Triceps"],
    estimatedMinutes: 2,
    instructions: ["Stand tall with feet hip-width apart", "Reach both arms straight overhead", "Interlace fingers and press palms up", "Hold and breathe deeply"],
    type: "static",
    primaryAngle: {
      name: "Shoulder",
      points: [POSE.RIGHT_HIP, POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW],
      altPoints: [POSE.LEFT_HIP, POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW],
    },
    holdConditions: [
      {
        name: "Arms Overhead",
        points: [POSE.RIGHT_HIP, POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW],
        altPoints: [POSE.LEFT_HIP, POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW],
        min: 155,
        max: 185,
      },
      {
        name: "Straight Elbow",
        points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW, POSE.RIGHT_WRIST],
        altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW, POSE.LEFT_WRIST],
        min: 155,
        max: 185,
      },
    ],
    holdDurationSec: 8,
    toleranceMs: 500,
    decayRate: 2.0,
    feedback: {
      holding: "Reach high — lengthen your spine.",
      complete: "Stretch complete!",
      lost: "Raise your arms fully overhead.",
    },
  },

  sideBend: {
    id: "sideBend",
    name: "Side Bend",
    emoji: "🤸",
    category: "stretching",
    target: "Obliques · Lats · Intercostals",
    demoUrl: getExerciseDemoUrl("sideBend"),
    videoUrl: getExerciseVideoUrl("sideBend"),
    difficulty: "beginner",
    muscles: ["Obliques", "Lats", "Intercostals", "Spine"],
    estimatedMinutes: 2,
    instructions: ["Stand with feet hip-width apart", "Raise one arm overhead", "Lean to the opposite side", "Hold and feel the stretch along your side"],
    type: "static",
    primaryAngle: {
      name: "Torso Angle",
      points: [POSE.RIGHT_HIP, POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW],
      altPoints: [POSE.LEFT_HIP, POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW],
    },
    holdConditions: [
      {
        name: "Torso Lean",
        points: [POSE.LEFT_HIP, POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW],
        altPoints: [POSE.RIGHT_HIP, POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW],
        min: 110,
        max: 165,
      },
    ],
    holdDurationSec: 8,
    toleranceMs: 600,
    decayRate: 2.0,
    feedback: {
      holding: "Breathe and lean deeper.",
      complete: "Side bend complete!",
      lost: "Lean to the side with your arm overhead.",
    },
  },

  hamstringStretch: {
    id: "hamstringStretch",
    name: "Hamstring Stretch",
    emoji: "🦶",
    category: "stretching",
    target: "Hamstrings · Calves · Lower Back",
    demoUrl: getExerciseDemoUrl("hamstringStretch"),
    videoUrl: getExerciseVideoUrl("hamstringStretch"),
    difficulty: "beginner",
    muscles: ["Hamstrings", "Calves", "Lower Back", "Glutes"],
    estimatedMinutes: 3,
    instructions: ["Stand with feet together or hip-width apart", "Hinge forward at the hips", "Keep legs as straight as possible", "Let gravity pull you deeper"],
    type: "static",
    primaryAngle: {
      name: "Hip Hinge",
      points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP, POSE.RIGHT_KNEE],
      altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_HIP, POSE.LEFT_KNEE],
    },
    holdConditions: [
      {
        name: "Forward Fold",
        points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP, POSE.RIGHT_KNEE],
        altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_HIP, POSE.LEFT_KNEE],
        min: 40,
        max: 110,
      },
      {
        name: "Straight Legs",
        points: [POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
        altPoints: [POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
        min: 150,
        max: 185,
      },
    ],
    holdDurationSec: 10,
    toleranceMs: 600,
    decayRate: 1.5,
    feedback: {
      holding: "Relax into the stretch — let gravity help.",
      complete: "Hamstring stretch complete!",
      lost: "Fold forward and keep your legs straight.",
    },
  },

  forwardFold: {
    id: "forwardFold",
    name: "Forward Fold",
    emoji: "🙏",
    category: "stretching",
    target: "Hamstrings · Lower Back · Spine",
    demoUrl: getExerciseDemoUrl("forwardFold"),
    videoUrl: getExerciseVideoUrl("forwardFold"),
    difficulty: "beginner",
    muscles: ["Hamstrings", "Lower Back", "Spine", "Calves"],
    estimatedMinutes: 2,
    instructions: ["Stand with feet together", "Exhale and fold forward from hips", "Let head and arms hang heavy", "Bend knees slightly if needed"],
    type: "static",
    primaryAngle: {
      name: "Hip Fold",
      points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP, POSE.RIGHT_KNEE],
      altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_HIP, POSE.LEFT_KNEE],
    },
    holdConditions: [
      {
        name: "Deep Fold",
        points: [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP, POSE.RIGHT_KNEE],
        altPoints: [POSE.LEFT_SHOULDER, POSE.LEFT_HIP, POSE.LEFT_KNEE],
        min: 20,
        max: 80,
      },
    ],
    holdDurationSec: 10,
    toleranceMs: 600,
    decayRate: 1.5,
    feedback: {
      holding: "Let your head hang heavy — breathe deep.",
      complete: "Forward fold complete!",
      lost: "Fold at the hips, reach towards the floor.",
    },
  },
};

// ── Utility: group exercises by category ──
export function getExercisesByCategory(): Record<
  ExerciseCategory,
  ExerciseConfig[]
> {
  const groups: Record<ExerciseCategory, ExerciseConfig[]> = {
    strength: [],
    yoga: [],
    stretching: [],
  };
  for (const ex of Object.values(EXERCISE_SCHEMA)) {
    groups[ex.category].push(ex);
  }
  return groups;
}
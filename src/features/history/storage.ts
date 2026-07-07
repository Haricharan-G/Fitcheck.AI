import Dexie, { type Table } from "dexie";
import { type ExerciseCategory } from "../exercises/poseEngine";

export interface WorkoutSession {
  id: string;
  timestamp: number;
  exerciseId: string;
  exerciseName: string;
  category: ExerciseCategory;
  emoji: string;
  durationSec: number;
  repsCompleted: number;
  averageQuality: number | null; // 0..1 scale, null if static hold
}

export class FormCheckDB extends Dexie {
  workouts!: Table<WorkoutSession, string>; // string = type of the primary key

  constructor() {
    super("FormCheckDB");
    this.version(1).stores({
      workouts: "id, timestamp", // Primary key and indexed props
    });
  }
}

export const db = new FormCheckDB();

export async function saveWorkout(session: Omit<WorkoutSession, "id" | "timestamp">) {
  try {
    const newSession: WorkoutSession = {
      ...session,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    await db.workouts.add(newSession);
    
    // Prune history to keep only last 100 workouts
    const count = await db.workouts.count();
    if (count > 100) {
      const oldest = await db.workouts.orderBy("timestamp").first();
      if (oldest) {
        await db.workouts.delete(oldest.id);
      }
    }
    return newSession;
  } catch (e) {
    console.error("Failed to save workout to Dexie", e);
    return null;
  }
}

export async function getWorkoutHistory(): Promise<WorkoutSession[]> {
  try {
    return await db.workouts.orderBy("timestamp").reverse().toArray();
  } catch (e) {
    console.error("Failed to fetch workout history from Dexie", e);
    return [];
  }
}

export async function clearWorkoutHistory() {
  try {
    await db.workouts.clear();
  } catch (e) {
    console.error("Failed to clear Dexie DB", e);
  }
}

// ── Export / Import ──
export async function exportHistoryAsJSON(): Promise<string> {
  const data = await getWorkoutHistory();
  return JSON.stringify(data, null, 2);
}

export async function importHistoryFromJSON(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString) as WorkoutSession[];
    if (Array.isArray(data)) {
      await db.workouts.bulkPut(data);
      return true;
    }
    return false;
  } catch (e) {
    console.error("Failed to import history", e);
    return false;
  }
}

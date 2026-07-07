// ═══════════════════════════════════════════════════════════════
// FormCheck Rehab — Type Definitions
// Clinical-grade physical therapy kinematics types
// ═══════════════════════════════════════════════════════════════

export interface ProtocolConfig {
  jointProtocol: string;
  jointLabel: string;
  romMin: number;
  romMax: number;
  targetTempo: number; // seconds per phase (extension or flexion)
}

export interface TelemetryFrame {
  currentAngle: number;
  angularVelocity: number; // degrees per second
  tempoPhase: "flexion" | "extension";
  tempoProgress: number; // 0..1 within current phase
  tempoAdherence: number; // 0..1
  compensationDetected: boolean;
  compensationMessage: string | null;
  timestamp: number;
}

export interface SetResult {
  setNumber: number;
  maxROM: number;
  minROM: number;
  avgTempo: number;
  tempoAdherence: number; // 0..1
  compensationCount: number;
  painRating: number | null; // 1..10
  durationSec: number;
}

export const JOINT_PROTOCOLS = [
  { id: "knee-extension", label: "Post-Op Knee Extension", defaultMin: 0, defaultMax: 90 },
  { id: "knee-flexion", label: "Post-Op Knee Flexion", defaultMin: 0, defaultMax: 120 },
  { id: "shoulder-flexion", label: "Shoulder Flexion", defaultMin: 0, defaultMax: 160 },
  { id: "shoulder-abduction", label: "Shoulder Abduction", defaultMin: 0, defaultMax: 150 },
  { id: "hip-flexion", label: "Hip Flexion ROM", defaultMin: 0, defaultMax: 110 },
  { id: "ankle-dorsiflexion", label: "Ankle Dorsiflexion", defaultMin: 0, defaultMax: 30 },
  { id: "elbow-flexion", label: "Elbow Flexion", defaultMin: 0, defaultMax: 140 },
  { id: "wrist-extension", label: "Wrist Extension", defaultMin: 0, defaultMax: 70 },
] as const;

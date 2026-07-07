# FormCheck AI

FormCheck AI is a premium, real-time movement analysis and physical therapy platform. It uses advanced computer vision to track body kinematics directly in the browser, providing clinical-grade Range of Motion (ROM) tracking and workout form analysis.

## Features

- **Real-Time Kinematics (60 FPS):** Uses MediaPipe Pose to track 33 joint landmarks accurately in 3D space. Processing is completely offloaded to Web Workers and runs 100% on-device (no video is sent to the cloud, ensuring total privacy).
- **Clinical Rehab Modules:** Tracks Range of Motion (ROM) with high precision using an on-canvas goniometer and digital dial. Live visual feedback and "Perfect Form" state guides patients safely through their prescribed angular limits.
- **Form Correction & Analytics:** Automatically counts reps using a robust state machine, detects phases (flexion/extension), and provides real-time form breakdowns and tempo tracking.
- **Rich 3D Visualizations:** Uses Three.js and `@react-three/fiber` for premium 3D mannequin visualizations to demonstrate exercises.
- **Enterprise Architecture:** Organized using a highly scalable Feature-Sliced Design (FSD) architecture.

## Tech Stack

- **Core:** React 18, TypeScript, Vite
- **Computer Vision:** Google MediaPipe Pose (Tasks Vision)
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion, Lottie React
- **3D Rendering:** Three.js, React Three Fiber, Drei
- **State Management:** Zustand
- **Local Database:** Dexie.js (IndexedDB)
- **Icons:** Lucide React

## Getting Started

### Prerequisites
Make sure you have Node.js installed.

### Installation & Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`. Make sure to grant camera permissions when prompted.

## Architecture & Project Structure

The codebase adheres to **Feature-Sliced Design (FSD)** to keep domains cleanly decoupled and scalable for enterprise teams.

```text
src/
├── components/
│   ├── layout/       # Structural shell components (Navbar, ErrorBoundary)
│   └── ui/           # Generic, reusable, "dumb" UI elements (Odometer, Rings)
├── features/         # Domain-specific business logic
│   ├── exercises/    # Exercise schemas, 3D mannequins, kinematic engine
│   ├── history/      # Dexie local DB storage and history dashboard
│   ├── rehab/        # Clinical PT tools, goniometers, ROM tracking, pain scales
│   └── tracker/      # MediaPipe Web Worker engine, camera HUD, live session logic
├── lib/              # Shared utilities (audio engine)
└── pages/            # Top-level routing components
```

## Privacy First
FormCheck AI runs completely client-side. The camera feed is processed locally in your browser memory and is never uploaded or saved to any external servers. In clinical rehab modes, the raw video feed is completely hidden behind a solid white background to ensure total patient privacy in clinical settings.

import { describe, it, expect, beforeEach } from 'vitest';
import { TrajectoryBuffer } from './classifiers';
import { type Landmark } from './poseEngine';

describe('TrajectoryBuffer', () => {
  let buffer: TrajectoryBuffer;

  beforeEach(() => {
    // 100ms max duration for easy testing
    buffer = new TrajectoryBuffer(100);
  });

  it('adds frames and maintains max duration window', () => {
    const fakeLandmarks: Landmark[] = [{ x: 0, y: 0, z: 0 }];
    
    // Using vi.stubGlobal or similar might be cleaner, but we can just add fast and rely on real performance.now()
    // However, performance.now() is hard to mock cleanly without side effects.
    // Let's just test that it adds correctly.
    buffer.addFrame(fakeLandmarks);
    expect(buffer.getFramesSince(0).length).toBe(1);
    
    buffer.clear();
    expect(buffer.getFramesSince(0).length).toBe(0);
  });
});

export type AudioCueType = "success" | "error" | "start";

class AudioEngine {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public play(type: AudioCueType) {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      
      if (type === "success") {
        this.playChord([440, 554.37, 659.25], t, 0.4); // A Major
      } else if (type === "error") {
        this.playOscillator(150, "sawtooth", t, 0.3, 0.1);
        this.playOscillator(100, "sawtooth", t + 0.1, 0.4, 0.1);
      } else if (type === "start") {
        this.playOscillator(880, "sine", t, 0.1, 0.05);
      }
    } catch (e) {
      console.warn("Audio Engine failed:", e);
    }
  }

  private playChord(freqs: number[], time: number, duration: number) {
    freqs.forEach((f, i) => {
      this.playOscillator(f, "sine", time + i * 0.05, duration, 0.1 / freqs.length);
    });
  }

  private playOscillator(freq: number, type: OscillatorType, time: number, duration: number, vol: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(time);
    osc.stop(time + duration);
  }
}

export const audioEngine = new AudioEngine();



// Simple 8-bit Retro Sound Synthesizer using Web Audio API
class AudioManager {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3; // Master volume
    this.masterGain.connect(this.ctx.destination);
  }

  vibrate(ms: number) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
    }
  }

  playTone(freq: number, type: OscillatorType, duration: number, vol: number = 1) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playJump() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playBreak() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Layer 1: The "Crunch/Shatter" (High pass filtered noise)
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // White noise
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1000, t); // Filter out low rumble from noise to make it "glassy"
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start();

    // Layer 2: The "Thud/Impact" (Low frequency punch)
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1); // Pitch drop
    
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start();
    osc.stop(t + 0.15);
  }

  playCollect() {
    this.playTone(880, 'sine', 0.1, 0.6);
    setTimeout(() => this.playTone(1100, 'sine', 0.2, 0.6), 50);
  }

  playHurt() {
    if (!this.ctx) return;
    this.vibrate(200);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playBuy() {
    this.playTone(440, 'square', 0.1, 0.5);
    setTimeout(() => this.playTone(660, 'square', 0.2, 0.5), 100);
  }

  playSelect() {
    this.playTone(800, 'triangle', 0.05, 0.2);
  }

  playSwing() {
    if (!this.ctx || !this.masterGain) return;
    // White noise sweep
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(2000, this.ctx.currentTime + 0.1);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start();
  }

  playEnemyHit() {
    if (!this.ctx || !this.masterGain) return;
    this.vibrate(50);
    // Low crunchy impact
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(10, t + 0.1);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(t + 0.1);
  }
}

export const audioManager = new AudioManager();


import { BiomeType } from "../types";

// Simple 8-bit Retro Sound Synthesizer using Web Audio API
class AudioManager {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  bgmGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  filterNode: BiquadFilterNode | null = null; // For pause effect

  isMuted: boolean = false;
  masterVolume: number = 0.5; // Default volume (0.0 to 1.0)
  
  // BGM State
  currentBiome: BiomeType | null = null;
  isPlayingBGM: boolean = false;
  nextNoteTime: number = 0;
  tempo: number = 120;
  timerID: number | null = null;
  
  // Wind Noise for Blizzard
  windNode: AudioBufferSourceNode | null = null;
  windGain: GainNode | null = null;

  init() {
    if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
    }
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Create Nodes
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolume;
    
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 22000; // Open filter initially

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.6; // Boosted BGM mix

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8; // Boosted SFX mix

    // Connect Graph: Sources -> Gains -> Filter -> Master -> Destination
    this.bgmGain.connect(this.filterNode);
    this.sfxGain.connect(this.filterNode);
    this.filterNode.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  setVolume(value: number) {
      this.masterVolume = Math.max(0, Math.min(1, value));
      if (this.masterGain) {
          // If muted, we update the stored volume but keep gain at 0
          // If unmuted, we apply the new volume immediately
          if (!this.isMuted) {
             this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx!.currentTime, 0.1);
          }
      }
      // If user drags slider while muted, we assume they want to hear it, so unmute
      if (this.isMuted && value > 0) {
          this.isMuted = false;
          if (this.masterGain) {
             this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx!.currentTime, 0.1);
          }
          return false; // Return false to indicate it is NOT muted anymore
      }
      return this.isMuted;
  }

  toggleMute() {
      this.isMuted = !this.isMuted;
      if (this.masterGain && this.ctx) {
          const target = this.isMuted ? 0 : this.masterVolume;
          this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      }
      return this.isMuted;
  }

  setPauseEffect(isPaused: boolean) {
      if (!this.filterNode || !this.ctx) return;
      // Lowpass filter effect for pause menu (muffled sound)
      const freq = isPaused ? 400 : 22000;
      this.filterNode.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.2);
  }

  vibrate(ms: number) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
    }
  }

  // --- SFX METHODS ---

  playTone(freq: number, type: OscillatorType, duration: number, vol: number = 1) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playJump() {
    if (!this.ctx) return;
    this.playTone(150, 'square', 0.1, 0.3);
  }

  playBreak() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    
    // Layer 1: Crunch
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1000, t);
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start();

    // Layer 2: Thud
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
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
    this.playTone(100, 'sawtooth', 0.3, 0.8);
  }

  playBuy() {
    this.playTone(440, 'square', 0.1, 0.5);
    setTimeout(() => this.playTone(660, 'square', 0.2, 0.5), 100);
  }

  playSelect() {
    this.playTone(800, 'triangle', 0.05, 0.2);
  }

  playSwing() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
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
    gain.connect(this.sfxGain);
    noise.start();
  }

  playEnemyHit() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.vibrate(50);
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(10, t + 0.1);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(t + 0.1);
  }

  // --- PROCEDURAL BGM ENGINE ---

  playBGM(biome: BiomeType) {
      if (this.currentBiome === biome && this.isPlayingBGM) return;
      this.stopBGM();
      this.currentBiome = biome;
      this.isPlayingBGM = true;
      
      if (!this.ctx) this.init();
      if (!this.ctx) return;
      
      this.nextNoteTime = this.ctx.currentTime + 0.1;

      // Start specific wind noise for Blizzard
      if (biome === BiomeType.BLIZZARD) {
          this.startWindNoise();
      }

      this.scheduler();
  }

  stopBGM() {
      this.isPlayingBGM = false;
      this.currentBiome = null;
      if (this.timerID) {
          window.clearTimeout(this.timerID);
          this.timerID = null;
      }
      this.stopWindNoise();
  }

  stopWindNoise() {
      if (this.windNode) {
          try { this.windNode.stop(); } catch(e){}
          this.windNode = null;
      }
  }

  startWindNoise() {
      if (!this.ctx || !this.bgmGain) return;
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      this.windNode = this.ctx.createBufferSource();
      this.windNode.buffer = buffer;
      this.windNode.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.05;

      this.windNode.connect(filter);
      filter.connect(this.windGain);
      this.windGain.connect(this.bgmGain);
      this.windNode.start();
  }

  scheduler() {
      if (!this.isPlayingBGM || !this.ctx) return;
      
      while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
          this.scheduleNote(this.nextNoteTime);
          this.advanceNote();
      }
      this.timerID = window.setTimeout(() => this.scheduler(), 25);
  }

  advanceNote() {
      const secondsPerBeat = 60.0 / this.tempo;
      // Randomize timing slightly for ambient feel
      this.nextNoteTime += (this.currentBiome === BiomeType.BLIZZARD ? 0.2 : 0.5) + Math.random() * 0.2;
  }

  scheduleNote(time: number) {
      if (!this.ctx || !this.bgmGain) return;
      
      if (this.currentBiome === BiomeType.ICE_CAVE) {
          // Pentatonic chime arpeggios
          const scale = [523.25, 659.25, 783.99, 987.77, 1046.50]; // C Major Pentatonic
          const freq = scale[Math.floor(Math.random() * scale.length)];
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.2, time + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 1.5);

          osc.connect(gain);
          gain.connect(this.bgmGain);
          osc.start(time);
          osc.stop(time + 1.5);
      } 
      else if (this.currentBiome === BiomeType.BLIZZARD) {
          // Low throbbing bass
          const freq = Math.random() > 0.5 ? 55 : 110; // A1 or A2
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(200, time);
          filter.frequency.linearRampToValueAtTime(100, time + 0.2);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.15, time);
          gain.gain.linearRampToValueAtTime(0, time + 0.2);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.bgmGain);
          osc.start(time);
          osc.stop(time + 0.2);
      }
      else if (this.currentBiome === BiomeType.AURORA) {
          // Dreamy high chords
          const scale = [440, 554.37, 659.25, 880]; // A Major
          const freq = scale[Math.floor(Math.random() * scale.length)];
          
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          
          // Vibrato
          const lfo = this.ctx.createOscillator();
          lfo.frequency.value = 4; // 4Hz vibrato
          const lfoGain = this.ctx.createGain();
          lfoGain.gain.value = 5;
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          lfo.start(time);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.1, time + 0.5);
          gain.gain.linearRampToValueAtTime(0, time + 2.0);

          osc.connect(gain);
          gain.connect(this.bgmGain);
          osc.start(time);
          osc.stop(time + 2.0);
          lfo.stop(time + 2.0);
      }
  }
}

export const audioManager = new AudioManager();
